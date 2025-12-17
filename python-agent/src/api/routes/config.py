"""Agent 配置路由 - 兼容原 Go 后端 API"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage import get_db
from src.storage.repositories import ProviderRepository

router = APIRouter()


# Provider 信息（预定义）
PROVIDER_INFO = {
    "openai": {
        "name": "openai",
        "displayName": "OpenAI",
        "description": "GPT-4o 和 GPT-4 Turbo 模型",
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o", "maxTokens": 128000, "priceInput": 5.0, "priceOutput": 15.0},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "maxTokens": 128000, "priceInput": 0.15, "priceOutput": 0.6},
            {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "maxTokens": 128000, "priceInput": 10.0, "priceOutput": 30.0},
        ],
        "defaultModel": "gpt-4o",
        "supportStream": True,
        "supportTools": True,
    },
    "deepseek": {
        "name": "deepseek",
        "displayName": "DeepSeek",
        "description": "DeepSeek Chat 和 Coder 模型",
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek Chat", "maxTokens": 64000, "priceInput": 0.14, "priceOutput": 0.28},
            {"id": "deepseek-coder", "name": "DeepSeek Coder", "maxTokens": 64000, "priceInput": 0.14, "priceOutput": 0.28},
        ],
        "defaultModel": "deepseek-chat",
        "supportStream": True,
        "supportTools": True,
    },
    "qwen": {
        "name": "qwen",
        "displayName": "通义千问",
        "description": "阿里云通义千问系列模型",
        "models": [
            {"id": "qwen-turbo", "name": "Qwen Turbo", "maxTokens": 8000, "priceInput": 0.8, "priceOutput": 2.0},
            {"id": "qwen-plus", "name": "Qwen Plus", "maxTokens": 32000, "priceInput": 4.0, "priceOutput": 12.0},
            {"id": "qwen-max", "name": "Qwen Max", "maxTokens": 32000, "priceInput": 20.0, "priceOutput": 60.0},
        ],
        "defaultModel": "qwen-turbo",
        "supportStream": True,
        "supportTools": True,
    },
    "doubao": {
        "name": "doubao",
        "displayName": "豆包",
        "description": "字节跳动豆包大模型",
        "models": [
            {"id": "doubao-pro-32k", "name": "豆包 Pro 32K", "maxTokens": 32000, "priceInput": 0.8, "priceOutput": 2.0},
            {"id": "doubao-lite-32k", "name": "豆包 Lite 32K", "maxTokens": 32000, "priceInput": 0.3, "priceOutput": 0.6},
        ],
        "defaultModel": "doubao-pro-32k",
        "supportStream": True,
        "supportTools": True,
    },
}


class ProviderModel(BaseModel):
    id: str
    name: str
    maxTokens: int
    priceInput: float
    priceOutput: float


class ProviderInfoResponse(BaseModel):
    name: str
    displayName: str
    description: str
    enabled: bool
    models: List[ProviderModel]
    defaultModel: str
    supportStream: bool
    supportTools: bool


class ConfigUpdateRequest(BaseModel):
    provider: str
    apiKey: str


@router.get("/agent/providers")
async def get_providers(db: AsyncSession = Depends(get_db)):
    """获取所有 Provider 信息"""
    repo = ProviderRepository(db)

    # 获取已配置的 providers
    configured_providers = {}
    try:
        db_providers = await repo.get_all()
        for p in db_providers:
            configured_providers[p.provider_type] = p.is_enabled
    except Exception:
        pass

    providers = []
    for name, info in PROVIDER_INFO.items():
        provider_data = {
            **info,
            "enabled": configured_providers.get(name, False),
        }
        providers.append(provider_data)

    return {"providers": providers}


@router.get("/agent/config")
async def get_config(db: AsyncSession = Depends(get_db)):
    """获取 Agent 配置"""
    repo = ProviderRepository(db)

    providers_config = {}
    try:
        db_providers = await repo.get_all()
        for p in db_providers:
            providers_config[p.provider_type] = {
                "apiKey": "***" if p.api_key else "",
                "enabled": p.is_enabled,
            }
    except Exception:
        pass

    # 填充未配置的 providers
    for name in PROVIDER_INFO.keys():
        if name not in providers_config:
            providers_config[name] = {
                "apiKey": "",
                "enabled": False,
            }

    return {
        "config": {
            "providers": providers_config,
            "defaultProvider": "deepseek",
            "defaultModel": "deepseek-chat",
        }
    }


@router.put("/agent/config")
async def update_config(
    data: ConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """更新 Provider API Key"""
    if data.provider not in PROVIDER_INFO:
        raise HTTPException(status_code=400, detail=f"不支持的 Provider: {data.provider}")

    repo = ProviderRepository(db)

    # 检查是否已存在
    existing = await repo.get_by_type(data.provider)

    if existing:
        # 更新
        await repo.update(
            provider_id=existing.id,
            api_key=data.apiKey,
            is_enabled=True,
        )
    else:
        # 创建
        provider_info = PROVIDER_INFO[data.provider]
        await repo.create(
            name=provider_info["displayName"],
            provider_type=data.provider,
            api_key=data.apiKey,
            default_model=provider_info["defaultModel"],
            is_enabled=True,
        )

    return {"success": True, "message": "配置已保存"}
