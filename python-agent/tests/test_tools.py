"""测试 K8s 工具模块"""
import pytest
from unittest.mock import patch, MagicMock


class TestQueryTools:
    """查询类工具测试"""

    @patch("src.tools.query.httpx.get")
    def test_list_pods(self, mock_get):
        """测试 list_pods"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "items": [
                {"metadata": {"name": "pod-1", "namespace": "default"}},
                {"metadata": {"name": "pod-2", "namespace": "default"}},
            ]
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        from src.tools.query import list_pods

        result = list_pods.invoke({"namespace": "default"})
        assert "pod-1" in result
        assert "pod-2" in result

    @patch("src.tools.query.httpx.get")
    def test_list_pods_error(self, mock_get):
        """测试 list_pods 错误处理"""
        import httpx

        mock_get.side_effect = httpx.RequestError("Connection failed")

        from src.tools.query import list_pods

        result = list_pods.invoke({"namespace": "default"})
        assert "error" in result.lower()


class TestDiagnosticTools:
    """诊断类工具测试"""

    @patch("src.tools.diagnostic.httpx.get")
    def test_get_pod_logs(self, mock_get):
        """测试 get_pod_logs"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"logs": "container log output"}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        from src.tools.diagnostic import get_pod_logs

        result = get_pod_logs.invoke({
            "namespace": "default",
            "name": "test-pod",
            "tail": 100,
        })
        assert "container log output" in result


class TestActionTools:
    """操作类工具测试"""

    @patch("src.tools.action.httpx.post")
    def test_scale_deployment(self, mock_post):
        """测试 scale_deployment"""
        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True, "replicas": 3}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        from src.tools.action import scale_deployment

        result = scale_deployment.invoke({
            "namespace": "default",
            "name": "test-deployment",
            "replicas": 3,
        })
        assert "success" in result.lower() or "true" in result.lower()
