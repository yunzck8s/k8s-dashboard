"""WebSocket 消息模型"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    """将 snake_case 转换为 camelCase"""
    components = string.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


class CamelCaseModel(BaseModel):
    """使用 camelCase 的基础模型"""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # 允许使用原始字段名或别名
    )


class ClientMessage(BaseModel):
    """客户端消息

    注意：客户端发送 snake_case，所以这里不使用 CamelCaseModel
    """
    type: str  # message, approval, cancel
    session_id: Optional[str] = None
    content: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None

    # 审批相关
    tool_call_id: Optional[str] = None
    decision: Optional[str] = None  # approve, reject, edit（注：Agno 不支持 edit）
    edited_args: Optional[Dict[str, Any]] = None


class ToolCall(CamelCaseModel):
    """工具调用"""
    id: str
    name: str
    arguments: Dict[str, Any]
    status: str = "pending"  # pending, running, completed, failed


class ToolResult(CamelCaseModel):
    """工具执行结果"""
    id: str
    name: str
    result: str
    success: bool
    error: Optional[str] = None


class ApprovalRequest(CamelCaseModel):
    """审批请求"""
    tool_call_id: str
    tool_name: str
    description: str
    impact: str
    risk_level: str  # low, medium, high
    arguments: Dict[str, Any]
    allowed_decisions: List[str] = ["approve", "reject"]


class TodoItem(CamelCaseModel):
    """待办项"""
    id: str
    content: str
    status: str  # pending, in_progress, completed


class TodosUpdate(CamelCaseModel):
    """待办列表更新"""
    items: List[TodoItem]


class SubAgentEvent(CamelCaseModel):
    """子代理事件"""
    agent_name: str
    event_type: str  # start, end, message
    content: str


class ServerMessage(CamelCaseModel):
    """服务端消息"""
    type: str  # session, chunk, tool_call, tool_result, approval_request, todos_update, subagent_event, done, error
    session_id: Optional[str] = None
    content: Optional[str] = None
    tool_call: Optional[ToolCall] = None
    tool_result: Optional[ToolResult] = None
    approval_request: Optional[ApprovalRequest] = None
    todos_update: Optional[TodosUpdate] = None
    subagent_event: Optional[SubAgentEvent] = None
    error: Optional[str] = None
