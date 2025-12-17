"""Session Repository

提供会话的 CRUD 操作。
"""
import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.models import ChatSession


class SessionRepository:
    """会话数据访问层"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        model: str,
        use_deep_agent: bool = False,
        title: Optional[str] = None,
        provider_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> ChatSession:
        """创建会话"""
        chat_session = ChatSession(
            id=str(uuid.uuid4()),
            title=title,
            provider_id=provider_id,
            model=model,
            use_deep_agent=use_deep_agent,
            messages=[],
            metadata_=metadata,
        )
        self.session.add(chat_session)
        await self.session.commit()
        await self.session.refresh(chat_session)
        return chat_session

    async def get_by_id(self, session_id: str) -> Optional[ChatSession]:
        """根据 ID 获取会话"""
        result = await self.session.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self, limit: int = 50, offset: int = 0) -> List[ChatSession]:
        """获取所有会话"""
        query = (
            select(ChatSession)
            .order_by(ChatSession.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update_messages(
        self,
        session_id: str,
        messages: list,
    ) -> Optional[ChatSession]:
        """更新会话消息"""
        chat_session = await self.get_by_id(session_id)
        if not chat_session:
            return None
        chat_session.messages = messages
        await self.session.commit()
        await self.session.refresh(chat_session)
        return chat_session

    async def update_title(
        self,
        session_id: str,
        title: str,
    ) -> Optional[ChatSession]:
        """更新会话标题"""
        chat_session = await self.get_by_id(session_id)
        if not chat_session:
            return None
        chat_session.title = title
        await self.session.commit()
        await self.session.refresh(chat_session)
        return chat_session

    async def delete(self, session_id: str) -> bool:
        """删除会话"""
        chat_session = await self.get_by_id(session_id)
        if not chat_session:
            return False
        await self.session.delete(chat_session)
        await self.session.commit()
        return True

    async def append_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[dict] = None,
    ) -> Optional[ChatSession]:
        """追加消息到会话"""
        chat_session = await self.get_by_id(session_id)
        if not chat_session:
            return None

        message = {
            "role": role,
            "content": content,
        }
        if metadata:
            message["metadata"] = metadata

        messages = list(chat_session.messages) if chat_session.messages else []
        messages.append(message)
        chat_session.messages = messages

        await self.session.commit()
        await self.session.refresh(chat_session)
        return chat_session
