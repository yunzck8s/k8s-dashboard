# Docker 镜像构建指南

本项目使用 GitHub Actions 自动构建和推送 Docker 镜像。

## 📋 功能特性

- ✅ 多阶段构建（前端 + 后端）
- ✅ 多平台支持（amd64 / arm64）
- ✅ 自动标签管理（latest / semver / SHA）
- ✅ 构建缓存优化（GitHub Actions Cache）
- ✅ 安全扫描（Trivy）
- ✅ 自动测试（健康检查）
- ✅ 双仓库推送（Docker Hub + GitHub Container Registry）

## 🔧 配置步骤

### 1. 配置 GitHub Secrets

在 GitHub 仓库中添加以下 Secrets：

**Settings → Secrets and variables → Actions → New repository secret**

#### 必需的 Secrets：

| Secret 名称 | 描述 | 获取方式 |
|------------|------|---------|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 | 你的 Docker Hub 账号 |
| `DOCKERHUB_TOKEN` | Docker Hub 访问令牌 | [Docker Hub → Account Settings → Security → New Access Token](https://hub.docker.com/settings/security) |

> **注意**: `GITHUB_TOKEN` 由 GitHub 自动提供，无需手动配置。

### 2. 修改镜像名称

编辑 `.github/workflows/docker-build.yml` 文件第 24 行：

```yaml
# 将 your-dockerhub-username 替换为你的 Docker Hub 用户名
DOCKERHUB_IMAGE: your-dockerhub-username/k8s-dashboard
```

### 3. 触发构建

工作流会在以下情况自动触发：

#### 自动触发：
- **推送到 main 分支**: 构建并推送 `latest` 标签
- **推送到 develop 分支**: 构建并推送 `develop` 标签
- **推送 Git 标签** (如 `v1.0.0`): 构建并推送语义化版本标签
- **创建 Pull Request**: 仅构建，不推送

#### 手动触发：
1. 进入 GitHub 仓库的 **Actions** 标签
2. 选择 **"构建并推送 Docker 镜像"** 工作流
3. 点击 **"Run workflow"**
4. 选择是否推送镜像

## 📦 镜像标签说明

构建的镜像会自动打上多个标签：

| 场景 | 生成的标签 | 示例 |
|------|-----------|------|
| 推送到 main | `latest`, `main-<sha>` | `latest`, `main-abc1234` |
| 推送到 develop | `develop`, `develop-<sha>` | `develop`, `develop-def5678` |
| 推送标签 v1.2.3 | `1.2.3`, `1.2`, `1`, `latest` | `1.2.3`, `1.2`, `1`, `latest` |
| Pull Request #42 | `pr-42` | `pr-42` |

## 🚀 使用镜像

### 从 Docker Hub 拉取：

```bash
# 最新版本
docker pull your-dockerhub-username/k8s-dashboard:latest

# 指定版本
docker pull your-dockerhub-username/k8s-dashboard:1.2.3
```

### 从 GitHub Container Registry 拉取：

```bash
# 最新版本
docker pull ghcr.io/your-github-username/k8s-dashboard:latest

# 指定版本
docker pull ghcr.io/your-github-username/k8s-dashboard:1.2.3
```

### 运行容器：

```bash
# 方式1：仅使用 SQLite（无需 PostgreSQL）
docker run -d \
  --name k8s-dashboard \
  -p 8080:8080 \
  -v dashboard-data:/var/lib/k8s-dashboard \
  -e SQLITE_PATH=/var/lib/k8s-dashboard/dashboard.db \
  -e ALLOW_SQLITE_FALLBACK=true \
  -e VICTORIA_METRICS_URL=http://your-vm:8428 \
  -e ALERTMANAGER_URL=http://your-am:9093 \
  -e JWT_SECRET=your-secret-key \
  your-dockerhub-username/k8s-dashboard:latest

# 方式2：使用 PostgreSQL（推荐生产）
docker run -d \
  --name k8s-dashboard \
  -p 8080:8080 \
  -e VICTORIA_METRICS_URL=http://your-vm:8428 \
  -e ALERTMANAGER_URL=http://your-am:9093 \
  -e POSTGRES_DSN='postgres://postgres:your-password@your-pg-host:5432/k8s_dashboard?sslmode=disable' \
  -e POSTGRES_HOST=your-pg-host \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your-password \
  -e POSTGRES_DB=k8s_dashboard \
  -e ALLOW_SQLITE_FALLBACK=false \
  -e JWT_SECRET=your-secret-key \
  your-dockerhub-username/k8s-dashboard:latest
```

### 使用 docker-compose：

```yaml
version: '3.8'

services:
  k8s-dashboard:
    image: your-dockerhub-username/k8s-dashboard:latest
    ports:
      - "8080:8080"
    volumes:
      - dashboard-data:/var/lib/k8s-dashboard
    environment:
      VICTORIA_METRICS_URL: http://victoria-metrics:8428
      ALERTMANAGER_URL: http://alertmanager:9093
      SQLITE_PATH: /var/lib/k8s-dashboard/dashboard.db
      ALLOW_SQLITE_FALLBACK: "true"
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your-password
      POSTGRES_DB: k8s_dashboard
      JWT_SECRET: your-secret-key
    restart: unless-stopped

volumes:
  dashboard-data:
```

## 🔍 本地构建测试

### 构建镜像：

```bash
# 从项目根目录执行
docker build -f deploy/docker/Dockerfile -t k8s-dashboard:local .
```

### 多平台构建：

```bash
# 需要先设置 buildx
docker buildx create --use

# 构建多平台镜像
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f deploy/docker/Dockerfile \
  -t k8s-dashboard:local \
  --load .
```

## 🔐 安全扫描

工作流会自动使用 Trivy 扫描镜像漏洞：

- 扫描 CRITICAL 和 HIGH 级别漏洞
- 结果上传到 GitHub Security 标签
- 查看路径: **Security → Code scanning alerts**

## 📊 构建优化

当前配置已包含以下优化：

1. **多阶段构建**: 最终镜像仅包含运行时文件
2. **层缓存**: 使用 GitHub Actions Cache
3. **并行构建**: 前端和后端独立构建
4. **.dockerignore**: 排除不必要的文件
5. **静态链接**: Go 编译为静态二进制（CGO_ENABLED=0）

## 🛠️ 自定义配置

### 修改构建参数

编辑 `.github/workflows/docker-build.yml` 的 `build-args` 部分：

```yaml
build-args: |
  BUILD_DATE=${{ github.event.head_commit.timestamp }}
  VCS_REF=${{ github.sha }}
  VERSION=${{ steps.meta.outputs.version }}
  # 添加自定义参数
  YOUR_CUSTOM_ARG=value
```

### 修改目标平台

默认构建 `linux/amd64` 和 `linux/arm64`，可修改为：

```yaml
platforms: linux/amd64  # 仅构建 x86_64
# 或
platforms: linux/amd64,linux/arm64,linux/arm/v7  # 添加更多平台
```

## 📝 版本发布流程

### 语义化版本发布：

```bash
# 1. 创建并推送标签
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# 2. GitHub Actions 自动构建并推送镜像
# 3. 镜像标签: 1.2.3, 1.2, 1, latest
```

### 预发布版本：

```bash
# 创建预发布标签
git tag -a v1.2.3-beta.1 -m "Beta release"
git push origin v1.2.3-beta.1

# 镜像标签: 1.2.3-beta.1
```

## 🐛 故障排查

### 构建失败

1. 检查 Actions 标签页的构建日志
2. 确认 Dockerfile 路径正确: `deploy/docker/Dockerfile`
3. 检查 go.mod 和 package.json 是否正确

### 推送失败

1. 确认 GitHub Secrets 配置正确
2. 检查 Docker Hub Token 权限（需要 Read & Write）
3. 确认镜像仓库存在或有创建权限

### 多平台构建失败

- 确保 Dockerfile 中的基础镜像支持目标平台
- 检查是否有平台特定的依赖

## 📚 相关资源

- [Docker 官方文档](https://docs.docker.com/)
- [GitHub Actions 文档](https://docs.github.com/actions)
- [Docker Buildx 文档](https://docs.docker.com/buildx/working-with-buildx/)
- [Trivy 安全扫描](https://github.com/aquasecurity/trivy)

## ⚡ 快速开始

```bash
# 1. Fork 或 Clone 仓库
git clone https://github.com/your-username/k8s-dashboard.git

# 2. 配置 GitHub Secrets
# 在 GitHub 页面配置 DOCKERHUB_USERNAME 和 DOCKERHUB_TOKEN

# 3. 修改镜像名称
# 编辑 .github/workflows/docker-build.yml 第 24 行

# 4. 推送代码触发构建
git add .
git commit -m "配置 Docker 构建"
git push origin main

# 5. 查看构建进度
# 访问 https://github.com/your-username/k8s-dashboard/actions
```
