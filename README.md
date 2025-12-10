# Kubernetes Dashboard 企业版

一个功能完善的 Kubernetes 集群管理面板，提供直观的 Web 界面来管理和监控 K8s 资源。

## 功能特性

### 集群概览
- 实时展示节点、Pod、Deployment、Service 等资源统计
- CPU、内存、Pod 容量使用率可视化
- 事件聚合与告警展示

### 工作负载管理
- **Pods**: 列表、详情、日志查看、终端访问、YAML 编辑
- **Deployments**: CRUD、扩缩容、滚动更新、回滚
- **StatefulSets**: 管理有状态应用
- **DaemonSets**: 管理守护进程
- **Jobs/CronJobs**: 任务调度与管理

### 网络资源
- **Services**: ClusterIP/NodePort/LoadBalancer 管理
- **Ingresses**: 入口规则配置

### 配置与存储
- **ConfigMaps**: 配置管理
- **Secrets**: 敏感信息管理
- **PV/PVC**: 持久化存储管理
- **StorageClasses**: 存储类配置

### 节点管理
- 节点状态监控
- 资源使用详情
- Taints/Labels 管理
- Cordon/Drain 操作

### RBAC 权限
- Roles/ClusterRoles 查看
- RoleBindings/ClusterRoleBindings 管理
- ServiceAccounts 管理

### 企业功能
- 多集群支持
- 审计日志
- 告警中心
- Web 终端

## 技术栈

### 前端
- React 18 + TypeScript
- Vite (构建工具)
- TailwindCSS (样式)
- Zustand (状态管理)
- React Query (服务端状态)
- Monaco Editor (YAML 编辑器)
- xterm.js (Web 终端)
- Recharts (图表)

### 后端
- Go 1.22
- Gin (Web 框架)
- client-go (Kubernetes 客户端)
- WebSocket (实时通信)

## 快速开始

### 前提条件
- Node.js 20+
- Go 1.22+
- Docker (可选)
- Kubernetes 集群访问权限

### 本地开发

```bash
# 克隆项目
git clone <repository-url>
cd k8s-dashboard

# 安装前端依赖
cd frontend && npm install

# 安装后端依赖
cd ../backend && go mod download

# 启动开发环境
cd .. && make dev
```

前端: http://localhost:5173
后端: http://localhost:8080

### Docker 构建

```bash
# 构建镜像
make docker

# 或指定镜像名称和标签
make docker IMAGE_NAME=my-k8s-dashboard IMAGE_TAG=v1.0.0
```

### Kubernetes 部署

```bash
# 构建并推送镜像
make docker IMAGE_NAME=your-registry/k8s-dashboard
make push DOCKER_REGISTRY=your-registry

# 修改 deploy/kubernetes/deployment.yaml 中的镜像地址
# 修改 deploy/kubernetes/ingress.yaml 中的域名

# 部署
make deploy

# 查看服务
kubectl get all -n k8s-dashboard
```

## 目录结构

```
k8s-dashboard/
├── frontend/                # React 前端
│   ├── src/
│   │   ├── api/            # API 调用
│   │   ├── components/     # 通用组件
│   │   ├── hooks/          # 自定义 Hooks
│   │   ├── layouts/        # 布局组件
│   │   ├── pages/          # 页面组件
│   │   ├── store/          # 状态管理
│   │   ├── types/          # TypeScript 类型
│   │   └── utils/          # 工具函数
│   └── ...
├── backend/                 # Go 后端
│   ├── cmd/server/         # 入口
│   └── internal/
│       ├── api/            # HTTP 处理器
│       ├── k8s/            # K8s 客户端
│       └── websocket/      # WebSocket
├── deploy/                  # 部署配置
│   ├── docker/             # Dockerfile
│   └── kubernetes/         # K8s 清单
└── Makefile                # 构建脚本
```

## API 端点

### REST API
```
GET    /api/v1/overview                      # 集群概览
GET    /api/v1/namespaces                    # 命名空间列表
GET    /api/v1/namespaces/:ns/pods           # Pod 列表
GET    /api/v1/namespaces/:ns/pods/:name     # Pod 详情
DELETE /api/v1/namespaces/:ns/pods/:name     # 删除 Pod
...
```

### WebSocket
```
/ws/logs?namespace=xxx&pod=xxx&container=xxx  # 实时日志
/ws/exec?namespace=xxx&pod=xxx&container=xxx  # 终端
/ws/watch?resource=xxx&namespace=xxx          # 资源监听
```

## 配置

### 环境变量
| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 8080 |
| KUBECONFIG | kubeconfig 路径 | ~/.kube/config |
| TZ | 时区 | Asia/Shanghai |

### Kubernetes RBAC
Dashboard 需要足够的权限来管理集群资源，部署时会自动创建 ServiceAccount 和 ClusterRole。

## 安全说明

1. **认证**: 支持 ServiceAccount Token、OIDC 等认证方式
2. **权限**: 使用 RBAC 代理，用户操作使用其自身权限
3. **审计**: 所有写操作记录审计日志
4. **TLS**: 生产环境建议使用 HTTPS

## 许可证

MIT License
