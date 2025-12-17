#!/bin/bash
# Python DeepAgent 服务启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv .venv
fi

# 激活虚拟环境
source .venv/bin/activate

# 检查依赖
if ! python -c "import langgraph" 2>/dev/null; then
    echo "安装依赖..."
    pip install -r requirements.txt
fi

# 检查 proto 文件
if [ ! -f "src/proto/agent_pb2.py" ]; then
    echo "生成 gRPC 代码..."
    python -m grpc_tools.protoc \
        -I./src/proto \
        --python_out=./src/proto \
        --grpc_python_out=./src/proto \
        ./src/proto/agent.proto
    # 修复导入
    sed -i 's/import agent_pb2/from . import agent_pb2/' src/proto/agent_pb2_grpc.py
fi

# 加载环境变量
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "启动 Python DeepAgent gRPC 服务..."
echo "  地址: ${GRPC_HOST:-0.0.0.0}:${GRPC_PORT:-50051}"
echo "  模型: ${DEFAULT_MODEL:-openai:gpt-4o}"

# 启动服务
PYTHONPATH=. python -m src.grpc_server
