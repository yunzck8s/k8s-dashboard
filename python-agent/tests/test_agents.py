"""测试 Agent 模块"""
import pytest


class TestMasterAgent:
    """Master Agent 测试"""

    def test_create_master_agent(self):
        """测试创建 Master Agent"""
        # TODO: 实现测试
        pass

    def test_k8s_tools_available(self):
        """测试 K8s 工具可用"""
        from src.agents.master import get_k8s_tools

        tools = get_k8s_tools()
        assert len(tools) > 0

        tool_names = [t.name for t in tools]
        assert "list_pods" in tool_names
        assert "get_pod" in tool_names
        assert "scale_deployment" in tool_names
