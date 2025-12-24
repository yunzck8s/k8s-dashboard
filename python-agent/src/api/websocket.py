"""WebSocket 处理器

处理 Agent 的 WebSocket 通信（Agno 版本）。
"""
import json
import uuid
from typing import Dict, Any, Optional
import structlog
from fastapi import WebSocket, WebSocketDisconnect

from agno.db.postgres import PostgresDb
from agno.db.in_memory import InMemoryDb
from agno.run.agent import RunEvent

from src.agents import create_team, TeamConfig
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


class TeamSession:
    """Team 会话（替代原来的 AgentSession）"""

    def __init__(
        self,
        session_id: str,
        team: Any,
    ):
        self.session_id = session_id
        self.team = team
        self.pending_approval: Optional[Any] = None  # 存储待处理的审批事件


class WebSocketManager:
    """WebSocket 连接管理器（Agno 版本）"""

    def __init__(self):
        self.sessions: Dict[str, TeamSession] = {}  # 存储 TeamSession
        self.db: Optional[PostgresDb] = None  # PostgresDb 替代 checkpointer
        self._db_initialized = False

    async def _ensure_db(self):
        """确保 PostgresDb 已初始化"""
        if not self._db_initialized:
            # 转换 asyncpg 连接字符串为 psycopg 格式
            db_url = settings.database_url
            if db_url and "+asyncpg" in db_url:
                db_url = db_url.replace("+asyncpg", "+psycopg")
                try:
                    self.db = PostgresDb(db_url=db_url)
                    logger.info("PostgresDb 初始化完成", db_url=db_url[:50] + "...")
                except Exception as e:
                    logger.error("PostgresDb 初始化失败，使用 InMemoryDb", error=str(e), exc_info=True)
                    self.db = InMemoryDb()
            else:
                logger.warning("数据库连接字符串未配置，使用 InMemoryDb")
                self.db = InMemoryDb()
            self._db_initialized = True
            logger.info(
                "数据库已初始化",
                type=type(self.db).__name__,
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
        """处理聊天消息（使用 Agno Team）"""
        session_id = message.session_id or str(uuid.uuid4())

        # 确保 db 已初始化
        await self._ensure_db()

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

            config = TeamConfig(
                model=model or "deepseek:deepseek-chat",
                api_key=api_key,
                base_url=base_url,
            )

            team = create_team(
                config=config,
                db=self.db,
            )

            self.sessions[session_id] = TeamSession(
                session_id=session_id,
                team=team,
            )

            # 发送会话创建响应
            await self._send_message(websocket, ServerMessage(
                type="session",
                session_id=session_id,
            ))

        session = self.sessions[session_id]

        # 流式执行 Team
        try:
            async for event in session.team.arun(
                input=message.content,
                session_id=session_id,
                user_id=session_id,  # Agno 使用 user_id 进行跨会话记忆
                stream=True,
                stream_events=True,
            ):
                await self._process_agno_event(websocket, session, event)

            # 发送完成信号（如果没有中断）
            if session.pending_approval is None:
                await self._send_message(websocket, ServerMessage(
                    type="done",
                    session_id=session_id,
                ))
        except Exception as e:
            logger.error("Team 执行错误", error=str(e), exc_info=True)
            await self._send_error(websocket, str(e), session_id)

    async def _handle_approval(self, websocket: WebSocket, message: ClientMessage):
        """处理审批响应（Agno 方式）"""
        session_id = message.session_id
        if not session_id or session_id not in self.sessions:
            await self._send_error(websocket, "会话不存在")
            return

        session = self.sessions[session_id]
        if not session.pending_approval:
            await self._send_error(websocket, "没有待处理的审批请求", session_id)
            return

        logger.info(
            "处理审批响应",
            session_id=session_id,
            tool_call_id=message.tool_call_id,
            decision=message.decision,
        )

        event = session.pending_approval

        # 处理审批决策
        active_requirements = getattr(event, 'active_requirements', [])
        for req in active_requirements:
            tool_execution = getattr(req, 'tool_execution', None)
            if not tool_execution:
                continue

            tool_call_id = getattr(tool_execution, 'tool_call_id', '')
            if tool_call_id == message.tool_call_id:
                if message.decision == "approve":
                    req.confirm()
                    logger.info("用户批准操作", tool_call_id=tool_call_id)
                elif message.decision == "reject":
                    req.reject("用户拒绝执行")
                    logger.info("用户拒绝操作", tool_call_id=tool_call_id)
                elif message.decision == "edit":
                    # Agno 不支持直接编辑，引导用户重新输入
                    req.reject("参数需要修改")
                    await self._send_message(websocket, ServerMessage(
                        type="chunk",
                        session_id=session_id,
                        content="❌ 操作已取消。请重新输入完整命令（包括修改后的参数）。",
                    ))
                    session.pending_approval = None
                    logger.info("用户请求编辑参数，操作已取消", tool_call_id=tool_call_id)
                    return
                break

        # 清除中断状态
        session.pending_approval = None

        # 恢复执行
        try:
            run_id = getattr(event, 'run_id', None)
            requirements = getattr(event, 'requirements', [])

            async for event_resumed in session.team.acontinue_run(
                run_id=run_id,
                requirements=requirements,
                stream=True,
                stream_events=True,
            ):
                await self._process_agno_event(websocket, session, event_resumed)

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
            session.pending_approval = None
            logger.info("取消请求", session_id=session_id)

    async def _process_agno_event(
        self,
        websocket: WebSocket,
        session: TeamSession,
        event,
    ):
        """处理 Agno 事件并映射到 ServerMessage"""
        # 获取事件类型
        event_type = getattr(event, 'event', None)

        # 1. 流式内容
        if event_type == RunEvent.run_content:
            content = getattr(event, 'content', None)
            if content:
                await self._send_message(websocket, ServerMessage(
                    type="chunk",
                    session_id=session.session_id,
                    content=content,
                ))

        # 2. 工具调用开始
        elif event_type == RunEvent.tool_call_started:
            tool = getattr(event, 'tool', None)
            if tool:
                await self._send_message(websocket, ServerMessage(
                    type="tool_call",
                    session_id=session.session_id,
                    tool_call=ToolCall(
                        id=getattr(tool, 'tool_call_id', str(uuid.uuid4())),
                        name=getattr(tool, 'tool_name', ''),
                        arguments=getattr(tool, 'tool_args', {}),
                        status="running",
                    ),
                ))

        # 3. 工具调用完成
        elif event_type == RunEvent.tool_call_completed:
            tool = getattr(event, 'tool', None)
            if tool:
                result = getattr(tool, 'result', '')
                result_str = str(result)[:10000]  # 限制长度
                await self._send_message(websocket, ServerMessage(
                    type="tool_result",
                    session_id=session.session_id,
                    tool_result=ToolResult(
                        id=getattr(tool, 'tool_call_id', ''),
                        name=getattr(tool, 'tool_name', ''),
                        result=result_str,
                        success=True,
                    ),
                ))

        # 4. Human-in-the-Loop（需要审批）
        if hasattr(event, 'is_paused') and event.is_paused:
            session.pending_approval = event

            active_requirements = getattr(event, 'active_requirements', [])
            for req in active_requirements:
                needs_confirmation = getattr(req, 'needs_confirmation', False)
                if needs_confirmation:
                    await self._send_approval_request(
                        websocket,
                        session.session_id,
                        req,
                    )

        # 5. 执行结束
        elif event_type == RunEvent.run_end:
            # 已在外层处理
            pass

    async def _send_approval_request(
        self,
        websocket: WebSocket,
        session_id: str,
        requirement,
    ):
        """发送审批请求到前端"""
        tool_execution = getattr(requirement, 'tool_execution', None)
        if not tool_execution:
            return

        tool_name = getattr(tool_execution, 'tool_name', '')
        tool_args = getattr(tool_execution, 'tool_args', {})
        tool_call_id = getattr(tool_execution, 'tool_call_id', str(uuid.uuid4()))

        # 生成描述
        descriptions = {
            "scale_deployment": f"扩缩容 Deployment {tool_args.get('namespace', 'default')}/{tool_args.get('name', '')} 到 {tool_args.get('replicas', '?')} 个副本",
            "restart_deployment": f"重启 Deployment {tool_args.get('namespace', 'default')}/{tool_args.get('name', '')}",
            "delete_pod": f"删除 Pod {tool_args.get('namespace', 'default')}/{tool_args.get('name', '')}",
        }

        # 生成风险等级
        risk_level = "high" if tool_name == "delete_pod" else "medium"

        # 生成影响说明
        impacts = {
            "scale_deployment": f"此操作会修改 Deployment 的副本数，可能影响服务可用性",
            "restart_deployment": f"此操作会滚动重启所有 Pod，服务会短暂中断",
            "delete_pod": f"此操作会立即终止 Pod，如果有控制器管理，新的 Pod 将被创建",
        }

        await self._send_message(websocket, ServerMessage(
            type="approval_request",
            session_id=session_id,
            approval_request=ApprovalRequest(
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                description=descriptions.get(tool_name, f"执行 {tool_name}"),
                impact=impacts.get(tool_name, "此操作可能影响集群状态"),
                risk_level=risk_level,
                arguments=tool_args,
                allowed_decisions=["approve", "reject"],  # 移除 "edit"
            ),
        ))

    async def _handle_interrupt(
        self,
        websocket: WebSocket,
        session: TeamSession,
        interrupt_data: Any,
    ):
        """处理中断（审批请求）- 已废弃，保留兼容性"""
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
