# Kubernetes Dashboard - 快速开始

本指南帮助您快速部署 K8s Dashboard 到 Kubernetes 集群。

## 前置条件

- Kubernetes 集群 (v1.20+)
- kubectl 命令行工具
- 集群中已安装 Ingress Controller（如 nginx-ingress）

## 快速部署

### 1. 部署依赖服务

#### 部署 PostgreSQL

```bash
# 修改密码
vim deploy/kustomize/dependencies/postgresql.yaml
# 找到 POSTGRES_PASSWORD: changeme 并修改为安全密码

# 部署
kubectl apply -f deploy/kustomize/dependencies/postgresql.yaml

# 等待 PostgreSQL 就绪
kubectl wait --for=condition=ready pod -l app=postgresql -n k8s-dashboard --timeout=300s
```

#### 部署 VictoriaMetrics

```bash
# 部署
kubectl apply -f deploy/kustomize/dependencies/victoria-metrics.yaml

# 等待 VictoriaMetrics 就绪
kubectl wait --for=condition=ready pod -l app=victoria-metrics -n monitoring --timeout=300s
```

### 2. 配置应用

#### 修改 Secret（必须）

```bash
# 编辑 Secret，设置数据库密码
vim deploy/kustomize/base/secret.yaml

# 修改以下内容（与 PostgreSQL 密码保持一致）:
stringData:
  POSTGRES_PASSWORD: "your-secure-password"
  JWT_SECRET: "your-jwt-secret-key"
```

#### 修改 ConfigMap（可选）

如果您的 PostgreSQL 或 VictoriaMetrics 地址不同，需要修改：

```bash
vim deploy/kustomize/base/configmap.yaml

# 修改以下配置:
data:
  POSTGRES_HOST: "postgresql.k8s-dashboard.svc.cluster.local"
  VICTORIA_METRICS_URL: "http://victoria-metrics.monitoring.svc.cluster.local:8428"
```

### 3. 部署应用

#### 部署到开发环境

```bash
# 验证配置
kubectl kustomize deploy/kustomize/overlays/dev

# 部署
kubectl apply -k deploy/kustomize/overlays/dev

# 查看状态
kubectl get pods -n k8s-dashboard -w
```

#### 部署到生产环境

```bash
# 1. 修改生产环境配置
vim deploy/kustomize/overlays/prod/kustomization.yaml
# 修改镜像仓库地址:
#   newName: your-registry.com/k8s-dashboard
#   newTag: v1.0.0

vim deploy/kustomize/overlays/prod/ingress-patch.yaml
# 修改域名:
#   host: dashboard.your-domain.com

# 2. 验证配置
kubectl kustomize deploy/kustomize/overlays/prod

# 3. 部署
kubectl apply -k deploy/kustomize/overlays/prod

# 4. 查看状态
kubectl get pods -n k8s-dashboard -w
```

### 4. 访问应用

#### 通过 Ingress 访问

```bash
# 查看 Ingress 配置
kubectl get ingress -n k8s-dashboard

# 配置 /etc/hosts 或 DNS
# 开发环境: dashboard-dev.example.com -> Ingress IP
# 生产环境: dashboard.your-domain.com -> Ingress IP

# 浏览器访问
# 开发: http://dashboard-dev.example.com
# 生产: https://dashboard.your-domain.com
```

#### 通过端口转发访问（临时）

```bash
# 端口转发
kubectl port-forward -n k8s-dashboard svc/k8s-dashboard 8080:80

# 浏览器访问
http://localhost:8080
```

## 验证部署

### 检查所有组件状态

```bash
# 检查 PostgreSQL
kubectl get pods -n k8s-dashboard -l app=postgresql
kubectl logs -n k8s-dashboard -l app=postgresql --tail=20

# 检查 VictoriaMetrics
kubectl get pods -n monitoring -l app=victoria-metrics
kubectl logs -n monitoring -l app=victoria-metrics --tail=20

# 检查 Dashboard
kubectl get pods -n k8s-dashboard -l app.kubernetes.io/name=k8s-dashboard
kubectl logs -n k8s-dashboard -l app.kubernetes.io/name=k8s-dashboard --tail=50
```

### 测试数据库连接

```bash
# 进入 Dashboard Pod
kubectl exec -it -n k8s-dashboard deployment/k8s-dashboard -- sh

# 测试 PostgreSQL 连接（如果安装了 psql 客户端）
# psql -h postgresql -U k8s_dashboard -d k8s_dashboard

# 测试 VictoriaMetrics 连接
# wget -O- http://victoria-metrics.monitoring.svc.cluster.local:8428/health
```

## 常见问题

### Pod 无法启动 - ImagePullBackOff

```bash
# 检查镜像是否存在
docker images | grep k8s-dashboard

# 如果镜像在本地，需要推送到镜像仓库或使用 kind/minikube 加载
# minikube:
minikube image load k8s-dashboard:latest

# kind:
kind load docker-image k8s-dashboard:latest

# 或推送到镜像仓库
docker tag k8s-dashboard:latest your-registry.com/k8s-dashboard:v1.0.0
docker push your-registry.com/k8s-dashboard:v1.0.0
```

### Pod 启动失败 - 数据库连接错误

```bash
# 检查 PostgreSQL 状态
kubectl get pods -n k8s-dashboard -l app=postgresql

# 检查 ConfigMap 配置
kubectl get configmap k8s-dashboard-config -n k8s-dashboard -o yaml

# 检查 Secret 配置
kubectl get secret k8s-dashboard-secret -n k8s-dashboard -o yaml

# 检查密码是否匹配
kubectl get secret postgresql-secret -n k8s-dashboard -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
kubectl get secret k8s-dashboard-secret -n k8s-dashboard -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
```

### Ingress 无法访问

```bash
# 检查 Ingress 状态
kubectl get ingress -n k8s-dashboard
kubectl describe ingress k8s-dashboard -n k8s-dashboard

# 检查 Ingress Controller
kubectl get pods -n ingress-nginx

# 检查 Service
kubectl get svc -n k8s-dashboard
```

## 卸载

```bash
# 删除应用
kubectl delete -k deploy/kustomize/overlays/dev
# 或
kubectl delete -k deploy/kustomize/overlays/prod

# 删除依赖服务（如果需要）
kubectl delete -f deploy/kustomize/dependencies/victoria-metrics.yaml
kubectl delete -f deploy/kustomize/dependencies/postgresql.yaml

# 注意：删除 PostgreSQL 会丢失所有数据！
```

## 下一步

- 查看 [完整部署文档](deploy/kustomize/README.md)
- 配置 TLS 证书
- 配置监控和告警
- 配置数据库备份
- 调整资源限制

## 获取帮助

如遇问题，请：
1. 查看 Pod 日志: `kubectl logs -n k8s-dashboard -l app.kubernetes.io/name=k8s-dashboard`
2. 查看事件: `kubectl get events -n k8s-dashboard --sort-by='.lastTimestamp'`
3. 提交 Issue: https://github.com/your-org/k8s-dashboard/issues
