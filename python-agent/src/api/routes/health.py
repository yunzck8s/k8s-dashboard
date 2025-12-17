"""健康检查路由"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "k8s-agent",
        "version": "0.2.0",
    }


@router.get("/ready")
async def ready_check():
    """就绪检查"""
    return {"ready": True}
