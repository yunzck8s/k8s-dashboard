#!/bin/bash

# Docker 本地构建和测试脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
IMAGE_NAME="k8s-dashboard"
TAG="${1:-local}"
CONTAINER_NAME="k8s-dashboard-test"
PORT=8080

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  K8s Dashboard - Docker 本地构建测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 清理旧容器
echo -e "${YELLOW}[1/5] 清理旧容器...${NC}"
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    echo -e "${GREEN}✓ 旧容器已清理${NC}"
else
    echo -e "${GREEN}✓ 无需清理${NC}"
fi
echo ""

# 检查 Dockerfile 是否存在
echo -e "${YELLOW}[2/5] 检查 Dockerfile...${NC}"
if [ ! -f "deploy/docker/Dockerfile" ]; then
    echo -e "${RED}✗ 错误: deploy/docker/Dockerfile 不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dockerfile 存在${NC}"
echo ""

# 构建镜像
echo -e "${YELLOW}[3/5] 构建 Docker 镜像...${NC}"
echo -e "${BLUE}镜像: ${IMAGE_NAME}:${TAG}${NC}"
docker build \
    -f deploy/docker/Dockerfile \
    -t "${IMAGE_NAME}:${TAG}" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
    --build-arg VERSION="${TAG}" \
    .

echo -e "${GREEN}✓ 镜像构建成功${NC}"
echo ""

# 查看镜像信息
echo -e "${YELLOW}[4/5] 镜像信息:${NC}"
docker images "${IMAGE_NAME}:${TAG}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# 启动容器
echo -e "${YELLOW}[5/5] 启动并测试容器...${NC}"
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "${PORT}:8080" \
    "${IMAGE_NAME}:${TAG}"

echo -e "${GREEN}✓ 容器已启动${NC}"
echo ""

# 等待服务启动
echo -e "${BLUE}等待服务启动...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:${PORT}/health > /dev/null; then
        echo -e "${GREEN}✓ 服务启动成功${NC}"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ 服务启动超时${NC}"
        echo -e "${YELLOW}容器日志:${NC}"
        docker logs "$CONTAINER_NAME"
        docker stop "$CONTAINER_NAME"
        docker rm "$CONTAINER_NAME"
        exit 1
    fi
done
echo ""

# 健康检查
echo -e "${YELLOW}执行健康检查...${NC}"
HEALTH_STATUS=$(curl -s http://localhost:${PORT}/health)
if echo "$HEALTH_STATUS" | grep -q "ok"; then
    echo -e "${GREEN}✓ 健康检查通过${NC}"
    echo -e "${BLUE}响应: ${HEALTH_STATUS}${NC}"
else
    echo -e "${RED}✗ 健康检查失败${NC}"
    echo -e "${RED}响应: ${HEALTH_STATUS}${NC}"
fi
echo ""

# 显示容器信息
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  容器运行信息${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ 容器名称: ${CONTAINER_NAME}${NC}"
echo -e "${GREEN}✓ 访问地址: http://localhost:${PORT}${NC}"
echo -e "${GREEN}✓ 健康检查: http://localhost:${PORT}/health${NC}"
echo ""
echo -e "${YELLOW}常用命令:${NC}"
echo -e "  查看日志:   ${BLUE}docker logs ${CONTAINER_NAME}${NC}"
echo -e "  查看日志(实时): ${BLUE}docker logs -f ${CONTAINER_NAME}${NC}"
echo -e "  进入容器:   ${BLUE}docker exec -it ${CONTAINER_NAME} sh${NC}"
echo -e "  停止容器:   ${BLUE}docker stop ${CONTAINER_NAME}${NC}"
echo -e "  删除容器:   ${BLUE}docker rm ${CONTAINER_NAME}${NC}"
echo ""
echo -e "${YELLOW}是否要查看实时日志? (y/n)${NC}"
read -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}按 Ctrl+C 退出日志查看${NC}"
    docker logs -f "$CONTAINER_NAME"
fi
