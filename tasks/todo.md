# README 重写任务清单（2026-04-09）

## 计划
- [x] 收集项目现状：功能、路由、部署、脚本、环境变量
- [x] 确认重写方向：面向新接手工程师，突出快速上手与生产部署
- [x] 重写根目录 `README.md`（结构化重排，信息对齐当前代码）
- [x] 自检文档准确性（命令、端点、变量、版本）
- [x] 在本文件补充评审结论

## 评审
- README 已重写为“定位 -> 功能矩阵 -> 快速开始 -> 部署 -> 配置 -> 权限/API -> 结构 -> CI/CD -> 安全建议”的结构。
- 已核对关键事实来源：`backend/cmd/server/main.go`、`backend/internal/api/router.go`、`backend/internal/db/manager.go`、`frontend/package.json`、`frontend/vite.config.ts`、`.github/workflows/*.yml`。
- 文档中新增并明确：默认管理员账户、WebSocket ticket 机制、`ALERTMANAGER_URL` 与 `VICTORIA_METRICS_URL` 默认值、前端 `ci:verify` 校验命令。
