# Kubernetes Dashboard 企业版

一个面向生产运维场景的 Kubernetes 管理面板。
提供统一的 Web UI 来完成资源管理、集群观测、告警处理、审计追踪和多集群切换。

## 你可以用它做什么

- 在一个界面里查看和管理核心资源：Pod、Deployment、StatefulSet、DaemonSet、Job/CronJob、Service、Ingress、ConfigMap、Secret、PV/PVC、StorageClass、Node、Namespace、RBAC。
- 对工作负载执行常见运维动作：扩缩容、重启、回滚、YAML 编辑、查看事件、查看日志、Web 终端进入容器。
- 处理告警与静默：可选接入 Alertmanager，支持告警摘要、告警确认（ack）、静默规则管理。
- 做集群状态观测：通过 Kubernetes Metrics Server 展示实时资源使用，趋势由前端滚动采样生成。
- 做权限治理：基于用户角色和命名空间范围控制访问。
- 做安全追踪：写操作审计日志、会话管理、审批流。
- 在多集群之间切换：通过请求级 `X-Cluster` 路由到目标集群。

## 功能矩阵

| 领域 | 能力 |
|---|---|
| 仪表盘 | 资源统计、健康分、风险聚焦、事件与告警总览 |
| 工作负载 | Pods / Deployments / StatefulSets / DaemonSets / Jobs / CronJobs 全链路管理 |
| 网络与配置 | Services、Ingresses、ConfigMaps、Secrets、存储资源管理 |
| 节点与命名空间 | Node 详情、指标、cordon/drain；Namespace 管理 |
| 权限与治理 | Roles、ClusterRoles、RoleBindings、ClusterRoleBindings、ServiceAccounts |
| 安全与审计 | JWT 登录、会话吊销、审批流、审计日志 |
| 观测与告警 | Alertmanager 告警、静默规则、趋势分析与异常检测 |
| 多集群 | 集群增删测切、请求级目标集群选择 |

## 技术栈

### 前端

- React 19 + TypeScript
- Vite 7
- TailwindCSS
- Zustand
- TanStack Query
- Monaco Editor（YAML 编辑）
- xterm.js（Web 终端）
- Recharts（图表）

### 后端

- Go 1.25+
- Gin
- client-go
- Gorilla WebSocket
- PostgreSQL / SQLite

## 快速开始

### 1. 前置条件

- Node.js 20+
- Go 1.25+
- 可访问 Kubernetes 集群（本地开发可使用当前 kubeconfig）

### 2. 启动开发环境

```bash
git clone <your-repo-url>
cd k8s-dashboard
make dev
```

启动后：

- 前端: `http://localhost:5173`
- 后端: `http://localhost:9099`

### 3. 首次登录

后端会在数据库初始化时自动创建默认管理员：

- 用户名: `admin`
- 密码: `admin123`

> 建议首次登录后立即修改默认密码。

## 常用命令

```bash
# 本地开发
make dev
make dev-frontend
make dev-backend

# 构建
make build
make frontend
make backend

# 代码质量
make lint
make fmt

# 后端测试
cd backend && go test ./...

# 前端质量校验（lint + smoke + build + 体积预算）
cd frontend && npm run ci:verify

# 镜像
make docker
make push DOCKER_REGISTRY=<registry>
```

## 部署

### Docker 镜像

```bash
make docker IMAGE_NAME=<image-name> IMAGE_TAG=<tag>
make push DOCKER_REGISTRY=<registry>
```

镜像使用多阶段构建：前端静态文件 + 后端二进制打包到同一容器。

### Kubernetes（Kustomize，推荐）

`deploy/kustomize` 提供了：

- `base/`: 通用基础配置
- `overlays/dev`: 开发环境覆盖
- `overlays/prod`: 生产环境覆盖
- `dependencies/`: PostgreSQL、已废弃的 VictoriaMetrics 示例依赖

```bash
# 查看渲染结果
kubectl kustomize deploy/kustomize/overlays/dev

# 部署开发环境
kubectl apply -k deploy/kustomize/overlays/dev

# 部署生产环境
kubectl apply -k deploy/kustomize/overlays/prod
```

详细说明见：

- `deploy/kustomize/README.md`
- `deploy/kustomize/QUICKSTART.md`

## 配置说明

### 数据库选择规则

服务启动时按以下顺序选择数据库：

1. `POSTGRES_DSN`
2. `POSTGRES_HOST` + 参数组合
3. SQLite（`SQLITE_PATH`）

若 PostgreSQL 连接失败：

- `ALLOW_SQLITE_FALLBACK=true`：自动回落 SQLite
- `ALLOW_SQLITE_FALLBACK=false`：启动失败

> SQLite 建议单副本运行；多副本建议使用 PostgreSQL。

### 关键环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 服务端口 | `9099` |
| `TZ` | 时区 | `Asia/Shanghai` |
| `KUBECONFIG` | kubeconfig 路径 | `~/.kube/config` |
| `JWT_SECRET` | JWT 密钥 | `k8s-dashboard-secret-key-change-in-production` |
| `CLUSTER_ENCRYPTION_KEY` | 多集群 kubeconfig 加密密钥（Base64 32 字节） | 空（回退为 `SHA-256(JWT_SECRET)`） |
| `MULTI_CLUSTER_ENABLED` | 是否启用多集群管理 | `true` |
| `POSTGRES_DSN` | PostgreSQL DSN（最高优先级） | 空 |
| `POSTGRES_HOST` | PostgreSQL 主机 | 空 |
| `POSTGRES_PORT` | PostgreSQL 端口 | `5432` |
| `POSTGRES_DB` | PostgreSQL 数据库名 | 空 |
| `POSTGRES_USER` | PostgreSQL 用户名 | 空 |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | 空 |
| `POSTGRES_SSLMODE` | PostgreSQL SSL 模式 | `disable` |
| `SQLITE_PATH` | SQLite 数据文件路径 | `./data/k8s-dashboard.db` |
| `ALLOW_SQLITE_FALLBACK` | PostgreSQL 失败时是否回落 SQLite | `true` |
| `ALERTMANAGER_ENABLED` | 是否启用 Alertmanager | `false` |
| `ALERTMANAGER_URL` | Alertmanager 地址，仅 `ALERTMANAGER_ENABLED=true` 时必填 | 空 |

## 认证、权限与多集群

### 角色模型

- `admin`: 全量权限（含用户与集群管理）
- `operator`: 资源操作权限
- `viewer`: 只读权限

### 权限控制

- 后端按路由和 HTTP 方法做最小角色校验。
- 非 admin 用户可绑定允许访问的命名空间列表。
- 高风险删除操作（如 namespace、PV、cluster 删除）默认收敛到 admin。

### 多集群行为

- 前端在请求中自动附带 `X-Cluster`。
- 服务端按请求头选择目标集群。
- 用户可切换当前集群；不可达时接口返回 `503` 且 `code=CLUSTER_UNAVAILABLE`。

## API 概览

### REST

- 基础路径：`/api/v1`
- 公开接口：`POST /api/v1/auth/login`
- 鉴权后接口：资源 CRUD、观测、告警、审计、审批等
- 管理员接口：`/api/v1/admin/*`（用户管理、审批规则）

典型资源模式：

```text
GET    /api/v1/{resources}
GET    /api/v1/namespaces/:ns/{resources}
GET    /api/v1/namespaces/:ns/{resources}/:name
POST   /api/v1/namespaces/:ns/{resources}
PUT    /api/v1/namespaces/:ns/{resources}/:name
DELETE /api/v1/namespaces/:ns/{resources}/:name
GET    /api/v1/namespaces/:ns/{resources}/:name/yaml
PUT    /api/v1/namespaces/:ns/{resources}/:name/yaml
```

### WebSocket

```text
POST /api/v1/ws/tickets        # 申请短期票据
GET  /ws/logs                  # Pod 实时日志
GET  /ws/exec                  # Pod 终端
GET  /ws/watch                 # 资源监听
```

## 项目结构

```text
k8s-dashboard/
├── frontend/                    # React 前端
│   └── src/
│       ├── api/                # API 封装
│       ├── components/         # 通用组件
│       ├── layouts/            # 布局
│       ├── pages/              # 页面（按资源域划分）
│       ├── store/              # Zustand 状态
│       └── utils/              # 工具函数
├── backend/                     # Go 后端
│   ├── cmd/server/             # 程序入口
│   └── internal/
│       ├── api/                # 路由、中间件、处理器
│       ├── auth/               # 用户、会话、审批
│       ├── clusters/           # 多集群管理
│       ├── audit/              # 审计日志
│       ├── alerts/             # 告警业务
│       ├── metrics/            # 旧 VictoriaMetrics 客户端（已从启动路径移除）
│       └── observation/        # 集群观测服务
├── deploy/
│   ├── docker/                 # Dockerfile
│   ├── kubernetes/             # 直接 kubectl 清单
│   └── kustomize/              # base + overlays 部署
├── docs/
└── Makefile
```

## CI/CD 与质量门禁

仓库内置 GitHub Actions：

- `backend-quality.yml`: `go test` + `golangci-lint` + `gosec`
- `frontend-quality.yml`: `npm run ci:verify`
- `docker-build.yml`: 镜像构建/推送 + Trivy 扫描

## 安全建议（生产环境）

- 修改默认管理员密码，替换 `JWT_SECRET`。
- 配置 `CLUSTER_ENCRYPTION_KEY`，避免使用默认回退。
- 生产多副本使用 PostgreSQL，并将 `ALLOW_SQLITE_FALLBACK=false`。
- 通过 Ingress/TLS 暴露服务，限制管理接口访问来源。
- 配合最小化 RBAC 与审计日志做变更追踪。

## 许可证

MIT License
