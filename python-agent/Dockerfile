# K8s Dashboard DeepAgents Service
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制源代码
COPY src/ ./src/

# 生成 gRPC 代码
RUN python -m grpc_tools.protoc \
    -I./src/proto \
    --python_out=./src/proto \
    --grpc_python_out=./src/proto \
    ./src/proto/agent.proto

# 设置 Python 路径
ENV PYTHONPATH=/app/src

# 暴露 gRPC 端口
EXPOSE 50051

# 启动服务
CMD ["python", "src/main.py"]
