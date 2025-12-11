# GitHub Actions 工作流

本目录包含项目的 CI/CD 自动化工作流。

## 📋 可用工作流

### 🐳 Docker 镜像构建 (`docker-build.yml`)

**功能**:
- 自动构建和推送 Docker 镜像
- 支持多平台（amd64, arm64）
- 自动标签管理
- 安全漏洞扫描
- 镜像健康检查测试

**触发条件**:
- 推送到 `main` 或 `develop` 分支
- 创建语义化版本标签（如 `v1.2.3`）
- Pull Request 到 `main` 分支
- 手动触发

**配置要求**:
1. 添加 GitHub Secrets:
   - `DOCKERHUB_USERNAME`: Docker Hub 用户名
   - `DOCKERHUB_TOKEN`: Docker Hub 访问令牌
2. 修改 `docker-build.yml` 中的镜像名称

**详细文档**: 请查看 [`docs/DOCKER_BUILD.md`](../docs/DOCKER_BUILD.md)

## 🚀 快速开始

### 1. 配置 Secrets

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

添加以下 Secrets:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

### 2. 修改配置

编辑 `workflows/docker-build.yml`:

```yaml
env:
  DOCKERHUB_IMAGE: your-dockerhub-username/k8s-dashboard
```

### 3. 触发构建

```bash
# 推送到主分支触发构建
git push origin main

# 或创建版本标签
git tag v1.0.0
git push origin v1.0.0
```

### 4. 查看结果

访问仓库的 **Actions** 标签页查看构建状态和日志。

## 📊 工作流状态

查看最新的工作流运行状态:
- 访问 **Actions** 标签页
- 选择对应的工作流
- 查看详细的构建日志和测试结果

## 🔧 自定义工作流

要添加新的工作流或修改现有工作流，请参考:
- [GitHub Actions 文档](https://docs.github.com/actions)
- [工作流语法](https://docs.github.com/actions/reference/workflow-syntax-for-github-actions)

## 📝 最佳实践

1. **使用 Secrets 管理敏感信息**: 永远不要在代码中硬编码密钥
2. **缓存依赖**: 使用 `cache` action 加速构建
3. **并行执行**: 独立的任务使用并行 job
4. **条件执行**: 使用 `if` 控制何时运行特定步骤
5. **状态检查**: 为关键分支启用必需的状态检查

## 🐛 故障排查

### 工作流失败

1. 查看 Actions 标签页的详细日志
2. 检查 Secrets 是否正确配置
3. 确认触发条件是否满足
4. 查看工作流文件语法是否正确

### 权限问题

- 确保 `GITHUB_TOKEN` 有足够的权限
- 检查仓库设置中的 Actions 权限
- 确认 Secrets 访问权限

## 📚 相关资源

- [完整 Docker 构建文档](../docs/DOCKER_BUILD.md)
- [GitHub Actions 文档](https://docs.github.com/actions)
- [Docker Buildx](https://docs.docker.com/buildx/)
