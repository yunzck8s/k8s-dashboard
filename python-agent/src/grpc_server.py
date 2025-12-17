"""gRPC 服务实现

实现 AgentService 的 gRPC 服务，处理双向流式对话。
支持 DeepAgents 的完整能力：规划、文件系统、子代理、Human-in-the-Loop。
"""
import asyncio
import json
import uuid
from typing import AsyncIterator, Dict, Any, Optional, List
from contextlib import asynccontextmanager
import grpc
from grpc import aio
import structlog

from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command

# 注意：这些文件需要通过 grpc_tools 生成
# python -m grpc_tools.protoc -I./src/proto --python_out=./src/proto --grpc_python_out=./src/proto ./src/proto/agent.proto
from src.proto import agent_pb2, agent_pb2_grpc
from src.agents.master import create_master_agent, AgentFeatures
from src.config import settings

logger = structlog.get_logger()


def create_checkpointer():
    """根据配置创建 checkpointer

    支持：
    - memory: MemorySaver（开发环境）
    - postgres: AsyncPostgresSaver（生产环境）
    """
    if settings.checkpointer_type == "postgres" and settings.postgres_uri:
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

            logger.info("使用 PostgreSQL checkpointer", uri=settings.postgres_uri[:30] + "...")
            # 注意：AsyncPostgresSaver 需要在 async context 中使用
            # 这里返回连接字符串，在 serve() 中初始化
            return ("postgres", settings.postgres_uri)
        except ImportError:
            logger.warning("langgraph-checkpoint-postgres 未安装，回退到 MemorySaver")
            return ("memory", MemorySaver())
    else:
        logger.info("使用 MemorySaver checkpointer（内存存储）")
        return ("memory", MemorySaver())


class AgentServicer(agent_pb2_grpc.AgentServiceServicer):
    """Agent gRPC 服务实现

    支持 DeepAgents 的完整能力：
    - 规划工具 (write_todos)
    - 文件系统 (ls, read_file, write_file, edit_file)
    - 子代理 (task)
    - Human-in-the-Loop (interrupt_on)
    """

    def __init__(self, checkpointer: Any, store: Optional[Any] = None):
        self.sessions: Dict[str, Any] = {}  # 会话缓存
        self.checkpointer = checkpointer    # MemorySaver 或 AsyncPostgresSaver
        self.store = store or InMemoryStore()  # 持久化存储
        self.pending_interrupts: Dict[str, Any] = {}  # 待处理的中断

    async def Chat(
        self,
        request_iterator: AsyncIterator[agent_pb2.ChatRequest],
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[agent_pb2.ChatResponse]:
        """双向流式对话"""
        logger.info("新的 Chat 连接建立")

        try:
            async for request in request_iterator:
                session_id = request.session_id or str(uuid.uuid4())
                logger.info(
                    "收到消息",
                    session_id=session_id,
                    content=request.content[:100] if request.content else "",
                    has_approval=request.HasField("tool_approval") if hasattr(request, 'HasField') else False,
                )

                # 获取或创建 Agent
                if session_id not in self.sessions:
                    # 构建模型标识，如 "openai:gpt-4o"
                    model = f"{request.provider}:{request.model}" if request.provider and request.model else None

                    # 解析特性配置
                    features = None
                    if request.features:
                        features = AgentFeatures(
                            enable_planning=request.features.enable_planning,
                            enable_filesystem=request.features.enable_filesystem,
                            enable_subagents=request.features.enable_subagents,
                            enable_memory=request.features.enable_memory,
                        )

                    agent = create_master_agent(
                        model=model,
                        checkpointer=self.checkpointer,
                        store=self.store,
                        features=features,
                    )
                    self.sessions[session_id] = {
                        "agent": agent,
                        "config": {"configurable": {"thread_id": session_id}},
                        "features": features,
                    }
                    # 发送会话创建响应
                    yield agent_pb2.ChatResponse(
                        type="session",
                        session_id=session_id,
                    )

                session = self.sessions[session_id]
                agent = session["agent"]
                config = session["config"]

                # 处理工具审批响应
                if request.HasField("tool_approval"):
                    async for event in self._handle_approval(
                        agent, session_id, config, request.tool_approval
                    ):
                        yield event
                    continue

                # 执行 Agent 并流式返回结果
                async for event in self._stream_agent_events(
                    agent, request.content, session_id, config
                ):
                    yield event

                # 发送完成信号（如果没有中断）
                if session_id not in self.pending_interrupts:
                    yield agent_pb2.ChatResponse(
                        type="done",
                        session_id=session_id,
                    )

        except Exception as e:
            logger.error(f"Chat 错误: {str(e)}", exc_info=True)
            yield agent_pb2.ChatResponse(
                type="error",
                error=str(e),
            )

    async def _handle_approval(
        self,
        agent: Any,
        session_id: str,
        config: dict,
        approval: agent_pb2.ToolApproval,
    ) -> AsyncIterator[agent_pb2.ChatResponse]:
        """处理工具审批响应

        根据用户决定恢复 Agent 执行：
        - approve: 执行原始工具调用
        - edit: 使用编辑后的参数执行
        - reject: 跳过此工具调用
        """
        logger.info(
            "处理工具审批",
            tool_call_id=approval.tool_call_id,
            decision=approval.decision,
        )

        # 获取待处理的中断信息
        interrupt_info = self.pending_interrupts.pop(session_id, None)
        if not interrupt_info:
            logger.warning("未找到待处理的中断", session_id=session_id)
            yield agent_pb2.ChatResponse(
                type="error",
                session_id=session_id,
                error="未找到待处理的审批请求",
            )
            return

        # 构建决定
        decision = {"type": approval.decision}
        if approval.decision == "edit" and approval.edited_arguments:
            try:
                edited_args = json.loads(approval.edited_arguments)
                # 找到对应的 action_request
                action_requests = interrupt_info.get("action_requests", [])
                for action in action_requests:
                    if action.get("id") == approval.tool_call_id:
                        decision["edited_action"] = {
                            "name": action["name"],
                            "args": edited_args,
                        }
                        break
            except json.JSONDecodeError:
                logger.error("编辑参数解析失败", args=approval.edited_arguments)

        # 恢复 Agent 执行
        try:
            async for event in agent.astream_events(
                Command(resume={"decisions": [decision]}),
                config=config,
                version="v2",
            ):
                async for response in self._process_event(event, session_id):
                    yield response
        except Exception as e:
            logger.error(f"恢复执行错误: {str(e)}", exc_info=True)
            yield agent_pb2.ChatResponse(
                type="error",
                session_id=session_id,
                error=str(e),
            )

    async def _stream_agent_events(
        self,
        agent: Any,
        content: str,
        session_id: str,
        config: dict,
    ) -> AsyncIterator[agent_pb2.ChatResponse]:
        """流式处理 Agent 事件

        Args:
            agent: DeepAgent 实例
            content: 用户消息内容
            session_id: 会话 ID
            config: LangGraph 配置，包含 thread_id 用于状态持久化
        """
        try:
            # 使用 DeepAgents 的 astream_events
            async for event in agent.astream_events(
                {"messages": [{"role": "user", "content": content}]},
                config=config,
                version="v2",
            ):
                async for response in self._process_event(event, session_id):
                    yield response

        except Exception as e:
            logger.error(f"Agent 执行错误: {str(e)}", exc_info=True)
            yield agent_pb2.ChatResponse(
                type="error",
                session_id=session_id,
                error=str(e),
            )

    async def _process_event(
        self,
        event: dict,
        session_id: str,
    ) -> AsyncIterator[agent_pb2.ChatResponse]:
        """处理单个 Agent 事件"""
        event_type = event.get("event", "")
        data = event.get("data", {})

        if event_type == "on_chat_model_stream":
            # 流式文本输出
            chunk = data.get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                yield agent_pb2.ChatResponse(
                    type="chunk",
                    session_id=session_id,
                    content=chunk.content,
                )

        elif event_type == "on_tool_start":
            # 工具调用开始
            tool_name = event.get("name", "")
            tool_input = data.get("input", {})
            run_id = event.get("run_id", str(uuid.uuid4()))

            # 检查是否是 write_todos 工具
            if tool_name == "write_todos":
                # 提取 todo 列表
                todos = tool_input.get("todos", tool_input.get("items", []))
                yield agent_pb2.ChatResponse(
                    type="todos_update",
                    session_id=session_id,
                    todos_update=agent_pb2.TodosUpdate(
                        items=[
                            agent_pb2.TodoItem(
                                id=str(i),
                                content=todo.get("content", ""),
                                status=todo.get("status", "pending"),
                            )
                            for i, todo in enumerate(todos)
                        ]
                    ),
                )
            else:
                yield agent_pb2.ChatResponse(
                    type="tool_call",
                    session_id=session_id,
                    tool_call=agent_pb2.ToolCall(
                        id=run_id,
                        name=tool_name,
                        arguments=json.dumps(tool_input, ensure_ascii=False),
                        status="running",
                    ),
                )

        elif event_type == "on_tool_end":
            # 工具调用结束
            tool_name = event.get("name", "")
            tool_output = data.get("output", "")
            run_id = event.get("run_id", "")

            # write_todos 的结果不需要单独发送
            if tool_name != "write_todos":
                yield agent_pb2.ChatResponse(
                    type="tool_result",
                    session_id=session_id,
                    tool_result=agent_pb2.ToolResult(
                        id=run_id,
                        name=tool_name,
                        result=str(tool_output)[:10000],  # 限制结果长度
                        success=True,
                    ),
                )

        elif event_type == "on_chain_start":
            # 检查是否是子 Agent 开始
            chain_name = event.get("name", "")
            # DeepAgents 的子代理通常以 "task" 或子代理名称标识
            if any(keyword in chain_name.lower() for keyword in ["subagent", "task", "diagnostics"]):
                yield agent_pb2.ChatResponse(
                    type="subagent_event",
                    session_id=session_id,
                    subagent_event=agent_pb2.SubAgentEvent(
                        agent_name=chain_name,
                        event_type="start",
                        content=f"子代理 {chain_name} 开始执行",
                    ),
                )

        elif event_type == "on_chain_end":
            # 检查是否是子 Agent 结束
            chain_name = event.get("name", "")
            if any(keyword in chain_name.lower() for keyword in ["subagent", "task", "diagnostics"]):
                yield agent_pb2.ChatResponse(
                    type="subagent_event",
                    session_id=session_id,
                    subagent_event=agent_pb2.SubAgentEvent(
                        agent_name=chain_name,
                        event_type="end",
                        content=f"子代理 {chain_name} 执行完成",
                    ),
                )

        # 处理 interrupt（Human-in-the-Loop）
        # DeepAgents 在 invoke 结果中返回 __interrupt__，但在 astream_events 中可能通过特定事件表示
        # 需要检查 data 中是否有 interrupt 信息
        if "__interrupt__" in str(data) or event_type == "on_interrupt":
            interrupt_data = data.get("__interrupt__", data.get("interrupt", []))
            if interrupt_data:
                async for response in self._handle_interrupt_event(interrupt_data, session_id):
                    yield response

    async def _handle_interrupt_event(
        self,
        interrupt_data: Any,
        session_id: str,
    ) -> AsyncIterator[agent_pb2.ChatResponse]:
        """处理中断事件（Human-in-the-Loop）"""
        try:
            # 解析中断数据
            if isinstance(interrupt_data, list) and len(interrupt_data) > 0:
                interrupt_value = interrupt_data[0]
                if hasattr(interrupt_value, 'value'):
                    interrupt_value = interrupt_value.value

                action_requests = interrupt_value.get("action_requests", [])
                review_configs = interrupt_value.get("review_configs", [])

                # 保存中断信息以便后续处理
                self.pending_interrupts[session_id] = {
                    "action_requests": action_requests,
                    "review_configs": review_configs,
                }

                # 为每个需要审批的操作发送审批请求
                config_map = {cfg["action_name"]: cfg for cfg in review_configs}

                for action in action_requests:
                    action_name = action.get("name", "")
                    action_args = action.get("args", {})
                    action_id = action.get("id", str(uuid.uuid4()))
                    review_config = config_map.get(action_name, {})

                    # 确定风险等级
                    risk_level = "medium"
                    if action_name in ["delete_pod"]:
                        risk_level = "high"
                    elif action_name in ["scale_deployment", "restart_deployment"]:
                        risk_level = "medium"

                    # 生成操作描述
                    description = self._generate_action_description(action_name, action_args)
                    impact = self._generate_action_impact(action_name, action_args)

                    yield agent_pb2.ChatResponse(
                        type="approval_request",
                        session_id=session_id,
                        approval_request=agent_pb2.ApprovalRequest(
                            tool_call_id=action_id,
                            tool_name=action_name,
                            description=description,
                            impact=impact,
                            risk_level=risk_level,
                            arguments=json.dumps(action_args, ensure_ascii=False),
                            allowed_decisions=review_config.get(
                                "allowed_decisions", ["approve", "reject"]
                            ),
                        ),
                    )

        except Exception as e:
            logger.error(f"处理中断事件错误: {str(e)}", exc_info=True)

    def _generate_action_description(self, action_name: str, args: dict) -> str:
        """生成操作描述"""
        descriptions = {
            "scale_deployment": f"将 Deployment {args.get('namespace', 'default')}/{args.get('name', '')} 扩缩容到 {args.get('replicas', '?')} 个副本",
            "restart_deployment": f"重启 Deployment {args.get('namespace', 'default')}/{args.get('name', '')}",
            "delete_pod": f"删除 Pod {args.get('namespace', 'default')}/{args.get('name', '')}",
        }
        return descriptions.get(action_name, f"执行 {action_name}")

    def _generate_action_impact(self, action_name: str, args: dict) -> str:
        """生成操作影响说明"""
        impacts = {
            "scale_deployment": "此操作会改变应用的副本数量，可能影响服务容量和资源使用",
            "restart_deployment": "此操作会滚动重启所有 Pod，服务在重启期间可能短暂不可用",
            "delete_pod": "此操作会立即终止 Pod，如果有控制器管理，新的 Pod 将被创建",
        }
        return impacts.get(action_name, "此操作可能影响集群状态")

    async def ExecuteTool(
        self,
        request: agent_pb2.ExecuteToolRequest,
        context: grpc.aio.ServicerContext,
    ) -> agent_pb2.ExecuteToolResponse:
        """执行工具（用于审批后的执行）

        注意：在 DeepAgents 架构中，工具执行通过 Command(resume=...) 完成，
        此方法保留用于兼容性。
        """
        logger.info(
            "ExecuteTool 调用",
            session_id=request.session_id,
            tool_name=request.tool_name,
        )

        return agent_pb2.ExecuteToolResponse(
            success=False,
            error="请使用 Chat 流中的 tool_approval 进行审批",
        )

    async def HealthCheck(
        self,
        request: agent_pb2.HealthCheckRequest,
        context: grpc.aio.ServicerContext,
    ) -> agent_pb2.HealthCheckResponse:
        """健康检查"""
        return agent_pb2.HealthCheckResponse(
            healthy=True,
            version="0.2.0",  # 更新版本号
            details={
                "sessions": str(len(self.sessions)),
                "pending_interrupts": str(len(self.pending_interrupts)),
                "framework": "deepagents",
                "status": "running",
            },
        )


async def serve():
    """启动 gRPC 服务

    支持两种 checkpointer：
    - memory: MemorySaver（开发环境，重启丢失）
    - postgres: AsyncPostgresSaver（生产环境，持久化）
    """
    checkpointer_type, checkpointer_config = create_checkpointer()
    store = InMemoryStore()  # 用于跨线程持久化

    if checkpointer_type == "postgres":
        # 使用 PostgreSQL checkpointer
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        async with AsyncPostgresSaver.from_conn_string(checkpointer_config) as checkpointer:
            # 首次运行时创建表
            await checkpointer.setup()
            logger.info("PostgreSQL checkpointer 初始化完成")

            await _start_server(checkpointer, store)
    else:
        # 使用 MemorySaver
        await _start_server(checkpointer_config, store)


async def _start_server(checkpointer: Any, store: Any):
    """启动 gRPC 服务器"""
    server = aio.server()
    agent_pb2_grpc.add_AgentServiceServicer_to_server(
        AgentServicer(checkpointer, store), server
    )

    listen_addr = f"{settings.grpc_host}:{settings.grpc_port}"
    server.add_insecure_port(listen_addr)

    logger.info(
        "gRPC 服务启动",
        address=listen_addr,
        framework="deepagents",
        checkpointer=type(checkpointer).__name__,
    )
    await server.start()
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())
