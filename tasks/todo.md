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

---

# 前后端契约与 UI 完整性修复（2026-04-21）

## 计划
- [x] 将 review findings 转为后端 handler 测试和前端 smoke contract 测试
- [x] 补齐 CronJob suspend、Job/CronJob YAML、Job pods、ReplicaSet 后端接口
- [x] 收敛前端 API 封装并接入 ReplicaSet 路由
- [x] 完成 Job/CronJob 详情页
- [x] 修复设计系统文档、缺失样式类、默认主题和窄屏布局
- [x] 运行后端测试、前端校验和 `make test`

## 评审
- 后端新增 fake client handler 测试覆盖 CronJob suspend、Job/CronJob YAML managedFields 清理、Job pods 关联查询和 ReplicaSet list/get/delete/yaml。
- 前端 smoke 已覆盖 ReplicaSet route/sidebar/lazy preload、Job/CronJob 详情占位文案移除、前端 API 与后端路由契约匹配。
- 验证已通过：`cd backend && go test ./...`、`cd frontend && npm run ci:verify`、`make test`。

---

# 后端默认端口调整为 9090（2026-04-24）

## 计划
- [x] 添加默认端口契约校验，先确认当前 8080 会失败
- [x] 将后端无 `PORT` 环境变量时的默认端口改为 9090
- [x] 同步 Vite 开发代理、脚本和文档中的默认后端端口引用
- [x] 运行相关验证并记录结果

## 评审
- 已将后端默认 `PORT` 从 8080 改为 9090，并同步 Vite 代理、Dockerfile、Docker 测试脚本、Kubernetes manifests、kustomize ConfigMap 和相关文档。
- 已新增 smoke 契约检查，确认 `backend/cmd/server/main.go` 和 `frontend/vite.config.ts` 的默认端口一致为 9090。
- 验证已通过：`cd frontend && npm run test:smoke`、`cd backend && go test ./...`。

---

# 后端默认端口修正为 9099（2026-04-24）

## 计划
- [x] 将 smoke 端口契约从 9090 改为 9099，并确认当前实现失败
- [x] 将后端默认端口、Vite 代理、Docker/Kubernetes 配置和文档统一改为 9099
- [x] 检查是否仍有 9090 默认端口残留
- [x] 运行相关验证并记录结果

## 评审
- 已将后端默认 `PORT`、Vite `/api` 和 `/ws` 代理、Dockerfile、Docker 测试脚本、Kubernetes manifests、kustomize ConfigMap 和相关文档统一改为 9099。
- 已确认 9099 当前未被本机监听进程占用。
- 验证已通过：`cd frontend && npm run test:smoke`、`cd backend && go test ./...`。
- 已检查除任务/经验记录外没有 9090 残留：`rg -n "9090" . --glob '!frontend/node_modules/**' --glob '!backend/bin/**' --glob '!tasks/todo.md' --glob '!tasks/lessons.md'` 无结果。

---

# Dashboard 骨架屏卡住排查与修复（2026-04-24）

## 计划
- [x] 复现并定位 Dashboard 卡住来源
- [x] 为 VictoriaMetrics 不可达时的快速失败行为添加后端测试
- [x] 修复 metrics 客户端错误吞掉导致 overview 串行等待超时的问题
- [x] 运行后端/前端验证并重启服务确认

## 评审
- 根因：集群 API 已连接，`/api/v1/namespaces`、`/api/v1/clusters`、`/api/v1/nodes`、`/api/v1/pods` 正常；Dashboard 卡在 `/api/v1/overview`，因为 VictoriaMetrics 不可达时 `GetClusterMetrics` 吞掉每次查询错误并串行等待多个超时。
- 直接连通性验证：`http://192.168.1.90:31007` 和 `http://192.168.1.90:32607` 从本机请求超时/连接失败。
- 修复：`GetClusterMetrics` 在首个关键 VictoriaMetrics 查询失败时返回错误，让 overview 走已有回退逻辑。
- 验证已通过：`cd backend && go test ./internal/metrics`、`cd backend && go test ./...`、`cd frontend && npm run test:smoke`。
- 重启后验证：`/api/v1/overview` 返回 200，约 5.2 秒；`/api/v1/namespaces` 约 26ms，`/api/v1/clusters` 约 172ms。Alertmanager 仍不可达，`/api/v1/alerts/summary` 返回 500。

---

# Metrics Server + Alertmanager 开关 + 首页 Cockpit 改版（2026-04-24）

## 计划
- [x] 增加后端测试覆盖 Metrics Server 指标和 Alertmanager disabled zero state
- [x] 后端移除 VictoriaMetrics 初始化路径，指标接口改用 Kubernetes Metrics Server
- [x] 增加 `ALERTMANAGER_ENABLED=false` 默认配置并同步部署/文档
- [x] 前端首页改为截图式深色 cockpit，并在 Alertmanager 关闭时不轮询告警
- [x] 更新 smoke 契约，运行后端/前端验证并浏览器验收

## 评审
- 后端启动路径已移除 `VICTORIA_METRICS_URL` / `metrics.NewClient`，`ALERTMANAGER_ENABLED` 默认 `false`，关闭时 `/alerts/summary` handler 返回 disabled zero state。
- `/metrics/cluster`、`/metrics/pods`、`/metrics/pods/:ns/:name` 由 Kubernetes Metrics Server 提供；历史 CPU/Memory 接口返回空数据和 `metrics-server has no historical storage` 状态。
- 首页已替换为深色 cockpit 布局，使用 overview、nodes、pods、workloads、events、namespaces、pod metrics 等真实接口；趋势只保存页面打开后的轮询快照。
- 验证已通过：`cd backend && go test ./...`、`cd frontend && npm run test:smoke`、`cd frontend && npm run ci:verify`。
- 本地服务已重启：后端 `:9099` 新代码运行中，前端 `:5173` 运行中。浏览器访问 `/dashboard` 因未登录重定向到 `/login`，未代输默认账号密码。

---

# Sidebar Cockpit 样式改版（2026-04-24）

## 计划
- [x] 重构 Sidebar 视觉为参考图样式
- [x] 保持现有路由、预加载和收起行为
- [x] 徽标使用真实 overview/alert 数据，不写死截图数字
- [x] 跑前端校验

## 评审
- 左侧导航改为参考图风格：320px 展开宽度、K8 品牌头、右上收起按钮、分组分隔线、深色高对比导航项、蓝色激活态。
- 保留现有路由和预加载；工作负载、网络、配置、RBAC 仍可进入对应子路由。
- 事件徽标来自 overview warning 数，告警徽标来自 Alertmanager critical 数；Alertmanager disabled 或无数据时不显示假数字。
- 验证已通过：`cd frontend && npm run ci:verify`。
