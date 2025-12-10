.PHONY: all build frontend backend docker clean dev help

# 变量
IMAGE_NAME ?= k8s-dashboard
IMAGE_TAG ?= latest
DOCKER_REGISTRY ?=

# 默认目标
all: build

# 帮助
help:
	@echo "K8s Dashboard 构建工具"
	@echo ""
	@echo "使用方法:"
	@echo "  make build        - 构建前后端"
	@echo "  make frontend     - 仅构建前端"
	@echo "  make backend      - 仅构建后端"
	@echo "  make docker       - 构建 Docker 镜像"
	@echo "  make push         - 推送 Docker 镜像"
	@echo "  make dev          - 启动开发环境"
	@echo "  make clean        - 清理构建产物"
	@echo ""

# 构建前端
frontend:
	@echo ">> 构建前端..."
	cd frontend && npm install && npm run build
	@echo ">> 前端构建完成"

# 构建后端
backend:
	@echo ">> 构建后端..."
	cd backend && go build -o bin/server ./cmd/server
	@echo ">> 后端构建完成"

# 构建所有
build: frontend backend
	@echo ">> 构建完成"

# 构建 Docker 镜像
docker:
	@echo ">> 构建 Docker 镜像..."
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) -f deploy/docker/Dockerfile .
	@echo ">> Docker 镜像构建完成: $(IMAGE_NAME):$(IMAGE_TAG)"

# 推送 Docker 镜像
push:
ifdef DOCKER_REGISTRY
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)
	docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)
else
	@echo "请设置 DOCKER_REGISTRY 变量"
	@echo "例如: make push DOCKER_REGISTRY=your-registry.com"
endif

# 开发模式 - 前端
dev-frontend:
	cd frontend && npm run dev

# 开发模式 - 后端
dev-backend:
	cd backend && go run ./cmd/server

# 开发模式 - 同时启动前后端
dev:
	@echo "启动开发环境..."
	@echo "前端: http://localhost:5173"
	@echo "后端: http://localhost:8080"
	@make -j2 dev-frontend dev-backend

# 清理
clean:
	@echo ">> 清理构建产物..."
	rm -rf frontend/dist
	rm -rf frontend/node_modules
	rm -rf backend/bin
	@echo ">> 清理完成"

# 部署到 Kubernetes
deploy:
	kubectl apply -f deploy/kubernetes/rbac.yaml
	kubectl apply -f deploy/kubernetes/deployment.yaml
	kubectl apply -f deploy/kubernetes/service.yaml
	@echo ">> 部署完成"
	@echo ">> 服务地址: kubectl get svc -n k8s-dashboard"

# 卸载
undeploy:
	kubectl delete -f deploy/kubernetes/ingress.yaml --ignore-not-found
	kubectl delete -f deploy/kubernetes/service.yaml --ignore-not-found
	kubectl delete -f deploy/kubernetes/deployment.yaml --ignore-not-found
	kubectl delete -f deploy/kubernetes/rbac.yaml --ignore-not-found
	@echo ">> 卸载完成"

# 格式化代码
fmt:
	cd backend && go fmt ./...
	cd frontend && npm run lint -- --fix

# 测试
test:
	cd backend && go test ./...
	cd frontend && npm run test

# 检查代码
lint:
	cd backend && golangci-lint run
	cd frontend && npm run lint
