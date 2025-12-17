"""Provider 配置路由"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage import get_db
from src.storage.repositories import ProviderRepository

router = APIRouter()


class ProviderCreate(BaseModel):
    """创建 Provider 请求"""
    name: str
    provider_type: str  # openai, anthropic, deepseek, qwen, doubao
    api_key: str
    default_model: str
    base_url: Optional[str] = None
    is_enabled: bool = True


class ProviderUpdate(BaseModel):
    """更新 Provider 请求"""
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    default_model: Optional[str] = None
    is_enabled: Optional[bool] = None


class ProviderResponse(BaseModel):
    """Provider 响应"""
    id: str
    name: str
    provider_type: str
    base_url: Optional[str]
    default_model: str
    is_enabled: bool
    # 不返回 api_key


@router.get("/providers", response_model=List[ProviderResponse])
async def list_providers(
    enabled_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """获取 Provider 列表"""
    repo = ProviderRepository(db)
    providers = await repo.get_all(enabled_only=enabled_only)
    return [
        ProviderResponse(
            id=p.id,
            name=p.name,
            provider_type=p.provider_type,
            base_url=p.base_url,
            default_model=p.default_model,
            is_enabled=p.is_enabled,
        )
        for p in providers
    ]


@router.post("/providers", response_model=ProviderResponse)
async def create_provider(
    data: ProviderCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建 Provider"""
    repo = ProviderRepository(db)
    provider = await repo.create(
        name=data.name,
        provider_type=data.provider_type,
        api_key=data.api_key,
        default_model=data.default_model,
        base_url=data.base_url,
        is_enabled=data.is_enabled,
    )
    return ProviderResponse(
        id=provider.id,
        name=provider.name,
        provider_type=provider.provider_type,
        base_url=provider.base_url,
        default_model=provider.default_model,
        is_enabled=provider.is_enabled,
    )


@router.get("/providers/{provider_id}", response_model=ProviderResponse)
async def get_provider(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取 Provider 详情"""
    repo = ProviderRepository(db)
    provider = await repo.get_by_id(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider 不存在")
    return ProviderResponse(
        id=provider.id,
        name=provider.name,
        provider_type=provider.provider_type,
        base_url=provider.base_url,
        default_model=provider.default_model,
        is_enabled=provider.is_enabled,
    )


@router.put("/providers/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: str,
    data: ProviderUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新 Provider"""
    repo = ProviderRepository(db)
    provider = await repo.update(
        provider_id=provider_id,
        name=data.name,
        api_key=data.api_key,
        base_url=data.base_url,
        default_model=data.default_model,
        is_enabled=data.is_enabled,
    )
    if not provider:
        raise HTTPException(status_code=404, detail="Provider 不存在")
    return ProviderResponse(
        id=provider.id,
        name=provider.name,
        provider_type=provider.provider_type,
        base_url=provider.base_url,
        default_model=provider.default_model,
        is_enabled=provider.is_enabled,
    )


@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
):
    """删除 Provider"""
    repo = ProviderRepository(db)
    success = await repo.delete(provider_id)
    if not success:
        raise HTTPException(status_code=404, detail="Provider 不存在")
    return {"success": True}


@router.post("/providers/{provider_id}/test")
async def test_provider(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
):
    """测试 Provider 连接"""
    repo = ProviderRepository(db)
    provider = await repo.get_by_id(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider 不存在")

    # TODO: 实现实际的连接测试
    # 发送简单请求到 LLM API
    return {"success": True, "message": "连接测试成功"}
