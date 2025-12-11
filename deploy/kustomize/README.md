# Kubernetes Dashboard - Kustomize 部署

本目录包含使用 Kustomize 部署 K8s Dashboard 的配置文件。

## 目录结构

```
deploy/kustomize/
├── base/                    # 基础配置
│   ├── namespace.yaml       # 命名空间
│   ├── rbac.yaml           # ServiceAccount、ClusterRole、ClusterRoleBinding
│   ├── configmap.yaml      # 配置文件
│   ├── secret.yaml         # 密钥
│   ├── deployment.yaml     # Deployment
│   ├── service.yaml        # Service
│   ├── ingress.yaml        # Ingress
│   └── kustomization.yaml  # Kustomize 配置
├── overlays/               # 环境特定配置
│   ├── dev/               # 开发环境
│   │   ├── kustomization.yaml
│   │   ├── configmap-patch.yaml
│   │   └── ingress-patch.yaml
│   └── prod/              # 生产环境
│       ├── kustomization.yaml
│       ├── configmap-patch.yaml
│       ├── ingress-patch.yaml
│       └── replicas-patch.yaml
└── dependencies/          # 依赖服务示例
    ├── postgresql.yaml
    └── victoria-metrics.yaml
```

## 前置要求

1. **Kubernetes 集群** (v1.20+)
2. **kubectl** 命令行工具
3. **kustomize** (kubectl 1.14+ 内置)

## 依赖服务

应用依赖以下服务，需要先部署：

### PostgreSQL

用于存储审计日志等持久化数据。

```bash
# 部署示例 PostgreSQL
kubectl apply -f dependencies/postgresql.yaml
```

配置项（在 ConfigMap 中）：
- `POSTGRES_HOST`: PostgreSQL 服务地址
- `POSTGRES_PORT`: 端口（默认 5432）
- `POSTGRES_DB`: 数据库名
- `POSTGRES_USER`: 用户名
- `POSTGRES_PASSWORD`: 密码（在 Secret 中）
- `POSTGRES_SSLMODE`: SSL 模式（disable/require）

### VictoriaMetrics

用于存储和查询 Kubernetes 指标数据。

```bash
# 部署示例 VictoriaMetrics
kubectl apply -f dependencies/victoria-metrics.yaml
```

配置项（在 ConfigMap 中）：
- `VICTORIA_METRICS_URL`: VictoriaMetrics 服务地址

## 部署步骤

### 1. 修改配置

#### 基础配置（所有环境共享）

编辑 `base/configmap.yaml` 和 `base/secret.yaml`：

```yaml
# base/configmap.yaml
data:
  POSTGRES_HOST: "your-postgres-host"
  VICTORIA_METRICS_URL: "your-vm-url"

# base/secret.yaml
stringData:
  POSTGRES_PASSWORD: "your-secure-password"
  JWT_SECRET: "your-jwt-secret"
```

#### 环境特定配置

**开发环境** - 编辑 `overlays/dev/configmap-patch.yaml` 和 `overlays/dev/ingress-patch.yaml`

**生产环境** - 编辑 `overlays/prod/configmap-patch.yaml`、`overlays/prod/ingress-patch.yaml` 和镜像信息

### 2. 验证配置

```bash
# 查看开发环境生成的配置
kubectl kustomize overlays/dev

# 查看生产环境生成的配置
kubectl kustomize overlays/prod
```

### 3. 部署到开发环境

```bash
kubectl apply -k overlays/dev
```

### 4. 部署到生产环境

```bash
kubectl apply -k overlays/prod
```

## 配置说明

### ConfigMap 配置项

| 配置项 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `PORT` | 服务端口 | 8080 | 是 |
| `TZ` | 时区 | Asia/Shanghai | 否 |
| `LOG_LEVEL` | 日志级别 (debug/info/warn/error) | info | 否 |
| `LOG_FORMAT` | 日志格式 (json/text) | json | 否 |
| `POSTGRES_HOST` | PostgreSQL 地址 | - | 是 |
| `POSTGRES_PORT` | PostgreSQL 端口 | 5432 | 是 |
| `POSTGRES_DB` | 数据库名 | - | 是 |
| `POSTGRES_USER` | 数据库用户 | - | 是 |
| `POSTGRES_SSLMODE` | SSL 模式 | disable | 否 |
| `VICTORIA_METRICS_URL` | VictoriaMetrics URL | - | 是 |
| `AUDIT_LOG_ENABLED` | 启用审计日志 | true | 否 |
| `AUDIT_LOG_MAX_SIZE` | 日志文件最大大小(MB) | 100 | 否 |
| `AUDIT_LOG_MAX_AGE` | 日志保留天数 | 30 | 否 |
| `AUDIT_LOG_MAX_BACKUPS` | 日志备份数量 | 10 | 否 |

### Secret 配置项

| 配置项 | 说明 | 必填 |
|--------|------|------|
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | 是 |
| `JWT_SECRET` | JWT 密钥 | 否 |

## 更新部署

### 更新配置

修改 ConfigMap 或 Secret 后重新应用：

```bash
kubectl apply -k overlays/dev
# 或
kubectl apply -k overlays/prod
```

Kustomize 会自动为 ConfigMap 和 Secret 添加 hash 后缀，触发 Pod 滚动更新。

### 更新镜像

```bash
# 方式1: 修改 overlays/*/kustomization.yaml 中的镜像标签
# 方式2: 使用 kubectl set image
kubectl set image deployment/k8s-dashboard dashboard=k8s-dashboard:v1.0.1 -n k8s-dashboard
```

## 回滚

```bash
# 查看部署历史
kubectl rollout history deployment/k8s-dashboard -n k8s-dashboard

# 回滚到上一版本
kubectl rollout undo deployment/k8s-dashboard -n k8s-dashboard

# 回滚到指定版本
kubectl rollout undo deployment/k8s-dashboard -n k8s-dashboard --to-revision=2
```

## 查看状态

```bash
# 查看 Pod 状态
kubectl get pods -n k8s-dashboard

# 查看日志
kubectl logs -f deployment/k8s-dashboard -n k8s-dashboard

# 查看服务
kubectl get svc -n k8s-dashboard

# 查看 Ingress
kubectl get ingress -n k8s-dashboard
```

## 删除部署

```bash
# 删除开发环境
kubectl delete -k overlays/dev

# 删除生产环境
kubectl delete -k overlays/prod
```

## 故障排查

### Pod 无法启动

```bash
# 查看 Pod 详情
kubectl describe pod -l app.kubernetes.io/name=k8s-dashboard -n k8s-dashboard

# 查看日志
kubectl logs -l app.kubernetes.io/name=k8s-dashboard -n k8s-dashboard --tail=100
```

### 无法连接 PostgreSQL

1. 检查 PostgreSQL 服务是否运行
2. 检查 ConfigMap 中的连接配置
3. 检查网络策略是否允许访问
4. 检查 Secret 中的密码是否正确

### 无法连接 VictoriaMetrics

1. 检查 VictoriaMetrics 服务是否运行
2. 检查 ConfigMap 中的 URL 配置
3. 检查网络策略是否允许访问

### ConfigMap 更新后 Pod 没有重启

Kustomize 会自动为 ConfigMap 添加 hash 后缀，应该会触发滚动更新。如果没有：

```bash
# 手动触发滚动更新
kubectl rollout restart deployment/k8s-dashboard -n k8s-dashboard
```

## 最佳实践

1. **Secret 管理**：生产环境建议使用外部密钥管理系统（如 Vault、Sealed Secrets）
2. **镜像标签**：生产环境使用具体版本号，避免使用 `latest`
3. **资源限制**：根据实际负载调整 CPU 和内存限制
4. **备份**：定期备份 PostgreSQL 数据库
5. **监控**：配置 Prometheus 监控和告警
6. **高可用**：生产环境至少运行 3 个副本
7. **网络策略**：使用 NetworkPolicy 限制 Pod 间通信

## 参考资料

- [Kustomize 官方文档](https://kustomize.io/)
- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [PostgreSQL on Kubernetes](https://www.postgresql.org/docs/)
- [VictoriaMetrics 文档](https://docs.victoriametrics.com/)
