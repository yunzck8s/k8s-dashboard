"""会话管理路由"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage import get_db
from src.storage.repositories import SessionRepository

router = APIRouter()


class SessionResponse(BaseModel):
    """会话响应"""
    id: str
    title: Optional[str]
    model: str
    use_deep_agent: bool
    created_at: str
    updated_at: str


class SessionDetailResponse(SessionResponse):
    """会话详情响应"""
    messages: list


@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """获取会话列表"""
    repo = SessionRepository(db)
    sessions = await repo.get_all(limit=limit, offset=offset)
    return [
        SessionResponse(
            id=s.id,
            title=s.title,
            model=s.model,
            use_deep_agent=s.use_deep_agent,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取会话详情"""
    repo = SessionRepository(db)
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return SessionDetailResponse(
        id=session.id,
        title=session.title,
        model=session.model,
        use_deep_agent=session.use_deep_agent,
        messages=session.messages or [],
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """删除会话"""
    repo = SessionRepository(db)
    success = await repo.delete(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"success": True}


class UpdateTitleRequest(BaseModel):
    """更新标题请求"""
    title: str


@router.put("/sessions/{session_id}/title")
async def update_session_title(
    session_id: str,
    data: UpdateTitleRequest,
    db: AsyncSession = Depends(get_db),
):
    """更新会话标题"""
    repo = SessionRepository(db)
    session = await repo.update_title(session_id, data.title)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"success": True}


@router.get("/sessions/{session_id}/export")
async def export_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """导出会话为 Markdown"""
    repo = SessionRepository(db)
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    # 生成 Markdown
    lines = [f"# {session.title or '对话记录'}", ""]
    for msg in session.messages or []:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if role == "user":
            lines.append(f"**用户:** {content}")
        elif role == "assistant":
            lines.append(f"**助手:** {content}")
        lines.append("")

    return {
        "filename": f"session_{session_id}.md",
        "content": "\n".join(lines),
    }
