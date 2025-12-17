"""WebSocket 处理器

处理 Agent 的 WebSocket 通信。
"""
import json
import uuid
from typing import Dict, Any, Optional
import structlog
from fastapi import WebSocket, WebSocketDisconnect

from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command

from src.agents import create_agent, AgentConfig
from src.api.models.messages import (
    ClientMessage,
    ServerMessage,
    ToolCall,
    ToolResult,
    ApprovalRequest,
    TodoItem,
    TodosUpdate,
    SubAgentEvent,
)
from src.storage import async_session_maker
from src.storage.repositories import ProviderRepository
from src.config import settings

logger = structlog.get_logger()


def get_postgres_connection_string() -> Optional[str]:
    """将 asyncpg 格式的连接字符串转换为 psycopg 格式"""
    db_url = settings.database_url
    if not db_url:
        return None
    # postgresql+asyncpg://user:pass@host:port/db -> postgresql://user:pass@host:port/db
    if "+asyncpg" in db_url:
        return db_url.replace("+asyncpg", "")
    return db_url


async def create_postgres_checkpointer():
    """创建 PostgreSQL checkpointer

    使用 psycopg 连接池创建长期运行的 checkpointer。
    连接池会自动管理连接的创建和回收。
    """
    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from psycopg_pool import AsyncConnectionPool

        conn_string = get_postgres_connection_string()
        if not conn_string:
            logger.warning("数据库连接字符串未配置，使用 MemorySaver")
            return MemorySaver()

        logger.info("初始化 PostgreSQL checkpointer...", conn_string=conn_string[:50] + "...")

        # 创建连接池（长期运行应用的推荐方式）
        pool = AsyncConnectionPool(
            conninfo=conn_string,
            min_size=1,
            max_size=10,
            open=False,  # 延迟打开
            kwargs={"autocommit": True},
        )
        await pool.open()

        # 使用连接池创建 checkpointer
        checkpointer = AsyncPostgresSaver(pool)

        # 创建必要的表（首次运行时需要）
        await checkpointer.setup()

        logger.info("PostgreSQL checkpointer 初始化完成")
        return checkpointer
    except ImportError as e:
        logger.warning("langgraph-checkpoint-postgres 或 psycopg_pool 未安装，使用 MemorySaver", error=str(e))
        return MemorySaver()
    except Exception as e:
        logger.error("PostgreSQL checkpointer 初始化失败，使用 MemorySaver", error=str(e), exc_info=True)
        return MemorySaver()


class AgentSession:
    """Agent 会话"""

    def __init__(
        self,
        session_id: str,
        agent: Any,
        config: dict,
        use_deep_agent: bool,
    ):
        self.session_id = session_id
        self.agent = agent
        self.config = config
        self.use_deep_agent = use_deep_agent
        self.pending_interrupt: Optional[Dict[str, Any]] = None


class WebSocketManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.sessions: Dict[str, AgentSession] = {}
        self.checkpointer = None  # 延迟初始化
        self.store = InMemoryStore()
        self._checkpointer_initialized = False

    async def _ensure_checkpointer(self):
        """确保 checkpointer 已初始化"""
        if not self._checkpointer_initialized:
            if settings.checkpointer_type == "postgres":
                self.checkpointer = await create_postgres_checkpointer()
            else:
                self.checkpointer = MemorySaver()
            self._checkpointer_initialized = True
            logger.info(
                "Checkpointer 已初始化",
                type=type(self.checkpointer).__name__,
            )

    async def _get_provider_api_key(self, provider: str) -> tuple[Optional[str], Optional[str]]:
        """从数据库获取 Provider 的 API Key

        Args:
            provider: Provider 类型 (如 "deepseek", "openai" 等)

        Returns:
            (api_key, base_url) 元组
        """
        try:
            async with async_session_maker() as session:
                repo = ProviderRepository(session)
                provider_config = await repo.get_by_type(provider)
                if provider_config and provider_config.is_enabled:
                    api_key = repo.get_decrypted_api_key(provider_config)
                    return api_key, provider_config.base_url
        except Exception as e:
            logger.warning("获取 Provider API Key 失败", provider=provider, error=str(e))
        return None, None

    async def handle_connection(self, websocket: WebSocket):
        """处理 WebSocket 连接"""
        await websocket.accept()
        logger.info("WebSocket 连接建立")

        try:
            while True:
                data = await websocket.receive_text()
                try:
                    message = ClientMessage.model_validate_json(data)
                    await self._handle_message(websocket, message)
                except Exception as e:
                    logger.error("处理消息失败", error=str(e))
                    await self._send_error(websocket, str(e))
        except WebSocketDisconnect:
            logger.info("WebSocket 连接断开")
        except Exception as e:
            logger.error("WebSocket 错误", error=str(e))

    async def _handle_message(self, websocket: WebSocket, message: ClientMessage):
        """处理客户端消息"""
        if message.type == "message":
            await self._handle_chat_message(websocket, message)
        elif message.type == "approval":
            await self._handle_approval(websocket, message)
        elif message.type == "cancel":
            await self._handle_cancel(websocket, message)
        else:
            await self._send_error(websocket, f"未知消息类型: {message.type}")

    async def _handle_chat_message(self, websocket: WebSocket, message: ClientMessage):
        """处理聊天消息"""
        session_id = message.session_id or str(uuid.uuid4())

        # 确保 checkpointer 已初始化
        await self._ensure_checkpointer()

        # 获取或创建会话
        if session_id not in self.sessions:
            model = f"{message.provider}:{message.model}" if message.provider and message.model else None
            provider = message.provider or "deepseek"

            # 从数据库获取 API Key
            api_key, base_url = await self._get_provider_api_key(provider)

            logger.info(
                "创建新会话",
                session_id=session_id,
                provider=provider,
                model=message.model,
                has_api_key=bool(api_key),
            )

            agent_config = AgentConfig(
                model=model or "deepseek:deepseek-chat",
                use_deep_agent=message.use_deep_agent,
                api_key=api_key,
                base_url=base_url,
                features=message.features.model_dump() if message.features else {},
            )

            agent = create_agent(
                config=agent_config,
                checkpointer=self.checkpointer,
                store=self.store if message.use_deep_agent else None,
            )

            self.sessions[session_id] = AgentSession(
                session_id=session_id,
                agent=agent,
                config={
                    "configurable": {"thread_id": session_id},
                    "recursion_limit": 100,  # 增加递归限制
                },
                use_deep_agent=message.use_deep_agent,
            )

            # 发送会话创建响应
            await self._send_message(websocket, ServerMessage(
                type="session",
                session_id=session_id,
            ))

        session = self.sessions[session_id]

        # 流式执行 Agent
        try:
            async for event in session.agent.astream_events(
                {"messages": [{"role": "user", "content": message.content}]},
                config=session.config,
                version="v2",
            ):
                await self._process_event(websocket, session, event)

            # 发送完成信号（如果没有中断）
            if session.pending_interrupt is None:
                await self._send_message(websocket, ServerMessage(
                    type="done",
                    session_id=session_id,
                ))
        except Exception as e:
            logger.error("Agent 执行错误", error=str(e), exc_info=True)
            await self._send_error(websocket, str(e), session_id)

    async def _handle_approval(self, websocket: WebSocket, message: ClientMessage):
        """处理审批响应"""
        session_id = message.session_id
        if not session_id or session_id not in self.sessions:
            await self._send_error(websocket, "会话不存在")
            return

        session = self.sessions[session_id]
        if session.pending_interrupt is None:
            await self._send_error(websocket, "没有待处理的审批请求", session_id)
            return

        logger.info(
            "处理审批响应",
            session_id=session_id,
            tool_call_id=message.tool_call_id,
            decision=message.decision,
        )

        # 构建决定
        decision = {"type": message.decision}
        if message.decision == "edit" and message.edited_args:
            action_requests = session.pending_interrupt.get("action_requests", [])
            for action in action_requests:
                if action.get("id") == message.tool_call_id:
                    decision["edited_action"] = {
                        "name": action["name"],
                        "args": message.edited_args,
                    }
                    break

        # 清除中断状态
        session.pending_interrupt = None

        # 恢复执行
        try:
            async for event in session.agent.astream_events(
                Command(resume={"decisions": [decision]}),
                config=session.config,
                version="v2",
            ):
                await self._process_event(websocket, session, event)

            if session.pending_interrupt is None:
                await self._send_message(websocket, ServerMessage(
                    type="done",
                    session_id=session_id,
                ))
        except Exception as e:
            logger.error("恢复执行错误", error=str(e), exc_info=True)
            await self._send_error(websocket, str(e), session_id)

    async def _handle_cancel(self, websocket: WebSocket, message: ClientMessage):
        """处理取消请求"""
        session_id = message.session_id
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            session.pending_interrupt = None
            logger.info("取消请求", session_id=session_id)

    async def _process_event(self, websocket: WebSocket, session: AgentSession, event: dict):
        """处理 Agent 事件"""
        event_type = event.get("event", "")
        data = event.get("data", {})

        if event_type == "on_chat_model_stream":
            chunk = data.get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                await self._send_message(websocket, ServerMessage(
                    type="chunk",
                    session_id=session.session_id,
                    content=chunk.content,
                ))

        elif event_type == "on_tool_start":
            tool_name = event.get("name", "")
            tool_input = data.get("input", {})
            run_id = event.get("run_id", str(uuid.uuid4()))

            # 检查是否是 write_todos 工具
            if tool_name == "write_todos":
                todos = tool_input.get("todos", tool_input.get("items", []))
                await self._send_message(websocket, ServerMessage(
                    type="todos_update",
                    session_id=session.session_id,
                    todos_update=TodosUpdate(
                        items=[
                            TodoItem(
                                id=str(i),
                                content=todo.get("content", ""),
                                status=todo.get("status", "pending"),
                            )
                            for i, todo in enumerate(todos)
                        ]
                    ),
                ))
            else:
                await self._send_message(websocket, ServerMessage(
                    type="tool_call",
                    session_id=session.session_id,
                    tool_call=ToolCall(
                        id=run_id,
                        name=tool_name,
                        arguments=tool_input,
                        status="running",
                    ),
                ))

        elif event_type == "on_tool_end":
            tool_name = event.get("name", "")
            tool_output = data.get("output", "")
            run_id = event.get("run_id", "")

            if tool_name != "write_todos":
                await self._send_message(websocket, ServerMessage(
                    type="tool_result",
                    session_id=session.session_id,
                    tool_result=ToolResult(
                        id=run_id,
                        name=tool_name,
                        result=str(tool_output)[:10000],
                        success=True,
                    ),
                ))

        elif event_type == "on_chain_start":
            chain_name = event.get("name", "")
            if any(keyword in chain_name.lower() for keyword in ["subagent", "task", "diagnostics"]):
                await self._send_message(websocket, ServerMessage(
                    type="subagent_event",
                    session_id=session.session_id,
                    subagent_event=SubAgentEvent(
                        agent_name=chain_name,
                        event_type="start",
                        content=f"子代理 {chain_name} 开始执行",
                    ),
                ))

        elif event_type == "on_chain_end":
            chain_name = event.get("name", "")
            if any(keyword in chain_name.lower() for keyword in ["subagent", "task", "diagnostics"]):
                await self._send_message(websocket, ServerMessage(
                    type="subagent_event",
                    session_id=session.session_id,
                    subagent_event=SubAgentEvent(
                        agent_name=chain_name,
                        event_type="end",
                        content=f"子代理 {chain_name} 执行完成",
                    ),
                ))

        # 处理中断（Human-in-the-Loop）
        if "__interrupt__" in str(data) or event_type == "on_interrupt":
            interrupt_data = data.get("__interrupt__", data.get("interrupt", []))
            if interrupt_data:
                await self._handle_interrupt(websocket, session, interrupt_data)

    async def _handle_interrupt(
        self,
        websocket: WebSocket,
        session: AgentSession,
        interrupt_data: Any,
    ):
        """处理中断（审批请求）"""
        try:
            if isinstance(interrupt_data, list) and len(interrupt_data) > 0:
                interrupt_value = interrupt_data[0]
                if hasattr(interrupt_value, 'value'):
                    interrupt_value = interrupt_value.value

                action_requests = interrupt_value.get("action_requests", [])
                review_configs = interrupt_value.get("review_configs", [])

                # 保存中断信息
                session.pending_interrupt = {
                    "action_requests": action_requests,
                    "review_configs": review_configs,
                }

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

                    description = self._generate_action_description(action_name, action_args)
                    impact = self._generate_action_impact(action_name)

                    await self._send_message(websocket, ServerMessage(
                        type="approval_request",
                        session_id=session.session_id,
                        approval_request=ApprovalRequest(
                            tool_call_id=action_id,
                            tool_name=action_name,
                            description=description,
                            impact=impact,
                            risk_level=risk_level,
                            arguments=action_args,
                            allowed_decisions=review_config.get(
                                "allowed_decisions", ["approve", "reject"]
                            ),
                        ),
                    ))
        except Exception as e:
            logger.error("处理中断失败", error=str(e), exc_info=True)

    def _generate_action_description(self, action_name: str, args: dict) -> str:
        """生成操作描述"""
        descriptions = {
            "scale_deployment": f"将 Deployment {args.get('namespace', 'default')}/{args.get('name', '')} 扩缩容到 {args.get('replicas', '?')} 个副本",
            "restart_deployment": f"重启 Deployment {args.get('namespace', 'default')}/{args.get('name', '')}",
            "delete_pod": f"删除 Pod {args.get('namespace', 'default')}/{args.get('name', '')}",
        }
        return descriptions.get(action_name, f"执行 {action_name}")

    def _generate_action_impact(self, action_name: str) -> str:
        """生成操作影响说明"""
        impacts = {
            "scale_deployment": "此操作会改变应用的副本数量，可能影响服务容量和资源使用",
            "restart_deployment": "此操作会滚动重启所有 Pod，服务在重启期间可能短暂不可用",
            "delete_pod": "此操作会立即终止 Pod，如果有控制器管理，新的 Pod 将被创建",
        }
        return impacts.get(action_name, "此操作可能影响集群状态")

    async def _send_message(self, websocket: WebSocket, message: ServerMessage):
        """发送消息到客户端"""
        await websocket.send_text(message.model_dump_json(by_alias=True))

    async def _send_error(
        self,
        websocket: WebSocket,
        error: str,
        session_id: Optional[str] = None,
    ):
        """发送错误消息"""
        await self._send_message(websocket, ServerMessage(
            type="error",
            session_id=session_id,
            error=error,
        ))


# 全局 WebSocket 管理器
websocket_manager = WebSocketManager()
