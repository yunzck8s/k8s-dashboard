package tools

import (
	"context"
	"fmt"

	"github.com/k8s-dashboard/backend/internal/agent/provider"
	"github.com/k8s-dashboard/backend/internal/k8s"
)

// RiskLevel 风险等级
type RiskLevel string

const (
	RiskLow    RiskLevel = "low"
	RiskMedium RiskLevel = "medium"
	RiskHigh   RiskLevel = "high"
)

// ToolCategory 工具类别
type ToolCategory string

const (
	CategoryQuery      ToolCategory = "query"
	CategoryDiagnostic ToolCategory = "diagnostic"
	CategoryAction     ToolCategory = "action"
	CategoryAnalysis   ToolCategory = "analysis"
)

// ToolHandler 工具处理函数
type ToolHandler func(ctx context.Context, args map[string]interface{}) (string, error)

// K8sTool K8s 工具定义
type K8sTool struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Category    ToolCategory        `json:"category"`
	RiskLevel   RiskLevel           `json:"riskLevel"`
	Parameters  provider.ToolParameters `json:"-"` // 不序列化 Parameters
	Handler     ToolHandler         `json:"-"` // 不序列化 Handler
}

// Registry 工具注册表
type Registry struct {
	tools     map[string]*K8sTool
	k8sClient *k8s.Client
}

// NewRegistry 创建工具注册表
func NewRegistry(k8sClient *k8s.Client) *Registry {
	r := &Registry{
		tools:     make(map[string]*K8sTool),
		k8sClient: k8sClient,
	}

	// 注册查询类工具
	r.registerQueryTools()

	// 注册诊断类工具
	r.registerDiagnosticTools()

	// 注册分析类工具
	r.registerAnalysisTools()

	// 注册操作类工具（需要审批）
	r.registerActionTools()

	return r
}

// Register 注册工具
func (r *Registry) Register(tool *K8sTool) {
	r.tools[tool.Name] = tool
}

// Get 获取工具
func (r *Registry) Get(name string) (*K8sTool, bool) {
	t, ok := r.tools[name]
	return t, ok
}

// List 列出所有工具
func (r *Registry) List() []*K8sTool {
	var result []*K8sTool
	for _, t := range r.tools {
		result = append(result, t)
	}
	return result
}

// ToProviderTools 转换为 Provider 工具格式
func (r *Registry) ToProviderTools() []provider.Tool {
	var result []provider.Tool
	for _, t := range r.tools {
		result = append(result, provider.Tool{
			Name:        t.Name,
			Description: t.Description,
			Parameters:  t.Parameters,
		})
	}
	return result
}

// Execute 执行工具
func (r *Registry) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	tool, ok := r.tools[name]
	if !ok {
		return "", fmt.Errorf("tool not found: %s", name)
	}
	return tool.Handler(ctx, args)
}

// GetRiskLevel 获取工具风险等级
func (r *Registry) GetRiskLevel(name string) RiskLevel {
	tool, ok := r.tools[name]
	if !ok {
		return RiskLow
	}
	return tool.RiskLevel
}

// RequiresApproval 检查工具是否需要审批
func (r *Registry) RequiresApproval(name string) bool {
	tool, ok := r.tools[name]
	if !ok {
		return false
	}
	return tool.RiskLevel == RiskMedium || tool.RiskLevel == RiskHigh
}

// GetToolDescription 获取工具的影响描述（用于审批）
func (r *Registry) GetToolDescription(name string, args map[string]interface{}) (string, string) {
	tool, ok := r.tools[name]
	if !ok {
		return "", ""
	}

	description := tool.Description
	impact := ""

	switch name {
	case "scale_deployment":
		ns := getStringArg(args, "namespace")
		n := getStringArg(args, "name")
		replicas := getIntArg(args, "replicas")
		impact = fmt.Sprintf("将 %s/%s 的副本数调整为 %d", ns, n, replicas)
	case "restart_deployment":
		ns := getStringArg(args, "namespace")
		n := getStringArg(args, "name")
		impact = fmt.Sprintf("将重启 %s/%s 的所有 Pod", ns, n)
	case "delete_pod":
		ns := getStringArg(args, "namespace")
		n := getStringArg(args, "name")
		impact = fmt.Sprintf("将删除 Pod %s/%s", ns, n)
	case "delete_deployment":
		ns := getStringArg(args, "namespace")
		n := getStringArg(args, "name")
		impact = fmt.Sprintf("将删除 Deployment %s/%s 及其所有 Pod（不可恢复）", ns, n)
	default:
		impact = "执行此操作可能影响集群资源"
	}

	return description, impact
}

// 辅助函数
func getStringArg(args map[string]interface{}, key string) string {
	if v, ok := args[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getIntArg(args map[string]interface{}, key string) int {
	if v, ok := args[key]; ok {
		switch n := v.(type) {
		case int:
			return n
		case float64:
			return int(n)
		}
	}
	return 0
}
