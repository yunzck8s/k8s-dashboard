#!/bin/bash

# Docker 清理脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

IMAGE_NAME="k8s-dashboard"
CONTAINER_NAME="k8s-dashboard-test"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  K8s Dashboard - Docker 清理工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 停止并删除容器
echo -e "${YELLOW}[1/3] 清理容器...${NC}"
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    echo -e "${GREEN}✓ 容器 ${CONTAINER_NAME} 已删除${NC}"
else
    echo -e "${BLUE}ℹ 未找到容器 ${CONTAINER_NAME}${NC}"
fi
echo ""

# 删除本地镜像
echo -e "${YELLOW}[2/3] 清理镜像...${NC}"
IMAGES=$(docker images "${IMAGE_NAME}" -q)
if [ -n "$IMAGES" ]; then
    echo -e "${BLUE}找到以下镜像:${NC}"
    docker images "${IMAGE_NAME}"
    echo ""
    echo -e "${YELLOW}是否删除这些镜像? (y/n)${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rmi $IMAGES -f
        echo -e "${GREEN}✓ 镜像已删除${NC}"
    else
        echo -e "${BLUE}ℹ 跳过镜像删除${NC}"
    fi
else
    echo -e "${BLUE}ℹ 未找到 ${IMAGE_NAME} 镜像${NC}"
fi
echo ""

# 清理悬空镜像（可选）
echo -e "${YELLOW}[3/3] 清理悬空镜像...${NC}"
DANGLING=$(docker images -f "dangling=true" -q)
if [ -n "$DANGLING" ]; then
    echo -e "${BLUE}找到 $(echo $DANGLING | wc -w) 个悬空镜像${NC}"
    echo -e "${YELLOW}是否清理悬空镜像? (y/n)${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rmi $DANGLING
        echo -e "${GREEN}✓ 悬空镜像已清理${NC}"
    else
        echo -e "${BLUE}ℹ 跳过悬空镜像清理${NC}"
    fi
else
    echo -e "${BLUE}ℹ 无悬空镜像需要清理${NC}"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  清理完成${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Docker 系统信息:${NC}"
docker system df
echo ""
echo -e "${YELLOW}提示: 可以使用以下命令清理更多空间:${NC}"
echo -e "  ${BLUE}docker system prune${NC}     - 清理所有未使用的资源"
echo -e "  ${BLUE}docker system prune -a${NC}  - 清理所有未使用的镜像和资源"
echo -e "  ${BLUE}docker volume prune${NC}     - 清理未使用的卷"
