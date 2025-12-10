# 多阶段构建

# ========== 前端构建 ==========
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制 package.json
COPY frontend/package*.json ./

# 安装依赖
RUN npm ci

# 复制源码
COPY frontend/ .

# 构建前端
RUN npm run build

# ========== 后端构建 ==========
FROM golang:1.22-alpine AS backend-builder

# 安装构建依赖
RUN apk add --no-cache git

WORKDIR /app/backend

# 复制 go.mod 和 go.sum
COPY backend/go.mod backend/go.sum ./

# 下载依赖
RUN go mod download

# 复制源码
COPY backend/ .

# 构建后端
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/server ./cmd/server

# ========== 最终镜像 ==========
FROM alpine:3.19

# 安装 CA 证书（用于 HTTPS 请求）
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=backend-builder /app/server .

# 从前端构建阶段复制静态文件
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 设置时区
ENV TZ=Asia/Shanghai

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# 运行
ENTRYPOINT ["./server"]
