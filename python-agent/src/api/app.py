"""FastAPI 应用入口"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import structlog

from src.config import settings
from src.storage import init_db, close_db
from src.api.websocket import websocket_manager
from src.api.routes import providers, sessions, health, config

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    try:
        logger.info("初始化数据库...")
        await init_db()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.warning("数据库初始化失败，部分功能可能不可用", error=str(e))
    logger.info("服务启动完成")
    yield
    # 关闭时
    try:
        logger.info("关闭数据库连接...")
        await close_db()
    except Exception:
        pass
    logger.info("服务已关闭")


def create_app() -> FastAPI:
    """创建 FastAPI 应用"""
    app = FastAPI(
        title="K8s Agent Service",
        description="K8s 智能运维助手 API",
        version="0.2.0",
        lifespan=lifespan,
    )

    # CORS 配置
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 生产环境应限制
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    app.include_router(health.router, tags=["Health"])
    app.include_router(providers.router, prefix="/api", tags=["Providers"])
    app.include_router(sessions.router, prefix="/api", tags=["Sessions"])
    app.include_router(config.router, prefix="/api/v1", tags=["Config"])

    # WebSocket 路由
    @app.websocket("/ws/chat")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket_manager.handle_connection(websocket)

    return app


# 应用实例
app = create_app()
