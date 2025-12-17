"""Provider 配置 Repository

提供 Provider 配置的 CRUD 操作。
"""
import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from cryptography.fernet import Fernet

from src.storage.models import ProviderConfig
from src.config import settings


class ProviderRepository:
    """Provider 配置数据访问层"""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._fernet = self._get_fernet()

    def _get_fernet(self) -> Optional[Fernet]:
        """获取加密器"""
        if settings.encryption_key:
            return Fernet(settings.encryption_key.encode())
        return None

    def _encrypt_api_key(self, api_key: str) -> str:
        """加密 API Key"""
        if self._fernet:
            return self._fernet.encrypt(api_key.encode()).decode()
        return api_key  # 未配置加密密钥时明文存储（开发环境）

    def _decrypt_api_key(self, encrypted_key: str) -> str:
        """解密 API Key"""
        if self._fernet:
            return self._fernet.decrypt(encrypted_key.encode()).decode()
        return encrypted_key

    async def create(
        self,
        name: str,
        provider_type: str,
        api_key: str,
        default_model: str,
        base_url: Optional[str] = None,
        is_enabled: bool = True,
    ) -> ProviderConfig:
        """创建 Provider 配置"""
        provider = ProviderConfig(
            id=str(uuid.uuid4()),
            name=name,
            provider_type=provider_type,
            api_key_encrypted=self._encrypt_api_key(api_key),
            base_url=base_url,
            default_model=default_model,
            is_enabled=is_enabled,
        )
        self.session.add(provider)
        await self.session.commit()
        await self.session.refresh(provider)
        return provider

    async def get_by_id(self, provider_id: str) -> Optional[ProviderConfig]:
        """根据 ID 获取 Provider"""
        result = await self.session.execute(
            select(ProviderConfig).where(ProviderConfig.id == provider_id)
        )
        return result.scalar_one_or_none()

    async def get_by_type(self, provider_type: str) -> Optional[ProviderConfig]:
        """根据类型获取 Provider"""
        result = await self.session.execute(
            select(ProviderConfig).where(ProviderConfig.provider_type == provider_type)
        )
        return result.scalar_one_or_none()

    async def get_all(self, enabled_only: bool = False) -> List[ProviderConfig]:
        """获取所有 Provider"""
        query = select(ProviderConfig)
        if enabled_only:
            query = query.where(ProviderConfig.is_enabled == True)
        query = query.order_by(ProviderConfig.created_at)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(
        self,
        provider_id: str,
        name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        default_model: Optional[str] = None,
        is_enabled: Optional[bool] = None,
    ) -> Optional[ProviderConfig]:
        """更新 Provider 配置"""
        provider = await self.get_by_id(provider_id)
        if not provider:
            return None

        if name is not None:
            provider.name = name
        if api_key is not None:
            provider.api_key_encrypted = self._encrypt_api_key(api_key)
        if base_url is not None:
            provider.base_url = base_url
        if default_model is not None:
            provider.default_model = default_model
        if is_enabled is not None:
            provider.is_enabled = is_enabled

        await self.session.commit()
        await self.session.refresh(provider)
        return provider

    async def delete(self, provider_id: str) -> bool:
        """删除 Provider"""
        provider = await self.get_by_id(provider_id)
        if not provider:
            return False
        await self.session.delete(provider)
        await self.session.commit()
        return True

    def get_decrypted_api_key(self, provider: ProviderConfig) -> str:
        """获取解密后的 API Key"""
        return self._decrypt_api_key(provider.api_key_encrypted)
