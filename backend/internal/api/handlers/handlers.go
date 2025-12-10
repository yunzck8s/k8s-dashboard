package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/k8s-dashboard/backend/internal/alertmanager"
	"github.com/k8s-dashboard/backend/internal/audit"
	"github.com/k8s-dashboard/backend/internal/k8s"
	"github.com/k8s-dashboard/backend/internal/metrics"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
	"sigs.k8s.io/yaml"
)

// Handler API 处理器
type Handler struct {
	k8s     *k8s.Client
	metrics *metrics.Client
	alerts  *alertmanager.Client
	audit   *audit.Client
}

// NewHandler 创建处理器
func NewHandler(k8sClient *k8s.Client, metricsClient *metrics.Client, alertClient *alertmanager.Client, auditClient *audit.Client) *Handler {
	return &Handler{
		k8s:     k8sClient,
		metrics: metricsClient,
		alerts:  alertClient,
		audit:   auditClient,
	}
}

// ListResponse 列表响应
type ListResponse struct {
	Items interface{} `json:"items"`
	Total int         `json:"total"`
}

// OverviewResponse 集群概览响应
type OverviewResponse struct {
	Nodes       ResourceCount `json:"nodes"`
	Pods        ResourceCount `json:"pods"`
	Deployments ResourceCount `json:"deployments"`
	Services    ResourceCount `json:"services"`
	Namespaces  int           `json:"namespaces"`
	Events      EventSummary  `json:"events"`
	Resources   ResourceUsage `json:"resources"`
}

type ResourceCount struct {
	Total    int `json:"total"`
	Ready    int `json:"ready"`
	NotReady int `json:"notReady"`
}

type EventSummary struct {
	Total   int `json:"total"`
	Warning int `json:"warning"`
	Normal  int `json:"normal"`
}

type ResourceUsage struct {
	CPU    UsageMetric `json:"cpu"`
	Memory UsageMetric `json:"memory"`
	Pods   UsageMetric `json:"pods"`
}

type UsageMetric struct {
	Used  float64 `json:"used"`
	Total float64 `json:"total"`
	Unit  string  `json:"unit"`
}

// ========== 集群概览 ==========

func (h *Handler) GetOverview(c *gin.Context) {
	ctx := context.Background()

	// 获取节点信息
	nodes, err := h.k8s.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	nodeCount := ResourceCount{Total: len(nodes.Items)}
	var totalCPU, usedCPU, totalMemory, usedMemory, totalPods, usedPods float64

	for _, node := range nodes.Items {
		ready := false
		for _, cond := range node.Status.Conditions {
			if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
				ready = true
				break
			}
		}
		if ready {
			nodeCount.Ready++
		} else {
			nodeCount.NotReady++
		}

		// 从 K8s 获取资源容量（作为备用）
		if cpu := node.Status.Allocatable.Cpu(); cpu != nil {
			totalCPU += float64(cpu.MilliValue()) / 1000
		}
		if mem := node.Status.Allocatable.Memory(); mem != nil {
			totalMemory += float64(mem.Value()) / (1024 * 1024 * 1024)
		}
		if pods := node.Status.Allocatable.Pods(); pods != nil {
			totalPods += float64(pods.Value())
		}
	}

	// 获取所有 Pod
	pods, err := h.k8s.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	podCount := ResourceCount{Total: len(pods.Items)}
	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodRunning {
			podCount.Ready++
		} else {
			podCount.NotReady++
		}
	}
	usedPods = float64(len(pods.Items))

	// 获取 Deployments
	deployments, err := h.k8s.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	deploymentCount := ResourceCount{Total: len(deployments.Items)}
	for _, dep := range deployments.Items {
		if dep.Status.ReadyReplicas == dep.Status.Replicas {
			deploymentCount.Ready++
		} else {
			deploymentCount.NotReady++
		}
	}

	// 获取 Services
	services, err := h.k8s.Clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	serviceCount := ResourceCount{Total: len(services.Items), Ready: len(services.Items)}

	// 获取 Namespaces
	namespaces, err := h.k8s.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 获取事件
	events, err := h.k8s.Clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	eventSummary := EventSummary{Total: len(events.Items)}
	for _, event := range events.Items {
		if event.Type == "Warning" {
			eventSummary.Warning++
		} else {
			eventSummary.Normal++
		}
	}

	// 优先从 VictoriaMetrics 获取资源使用数据
	vmDataUsed := false
	if h.metrics != nil {
		clusterMetrics, err := h.metrics.GetClusterMetrics()
		if err == nil {
			usedCPU = clusterMetrics.CPU.Used
			usedMemory = clusterMetrics.Memory.Used
			// 如果 VM 返回了总量数据，也使用它
			if clusterMetrics.CPU.Total > 0 {
				totalCPU = clusterMetrics.CPU.Total
			}
			if clusterMetrics.Memory.Total > 0 {
				totalMemory = clusterMetrics.Memory.Total
			}
			if clusterMetrics.Pods.Total > 0 {
				totalPods = clusterMetrics.Pods.Total
			}
			if clusterMetrics.Pods.Used > 0 {
				usedPods = clusterMetrics.Pods.Used
			}
			vmDataUsed = true
		}
	}

	// 如果 VM 不可用，回退到 Kubernetes Metrics Server
	if !vmDataUsed && h.k8s.MetricsClient != nil {
		nodeMetrics, err := h.k8s.MetricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
		if err == nil {
			usedCPU = 0
			usedMemory = 0
			for _, nm := range nodeMetrics.Items {
				if cpu := nm.Usage.Cpu(); cpu != nil {
					usedCPU += float64(cpu.MilliValue()) / 1000
				}
				if mem := nm.Usage.Memory(); mem != nil {
					usedMemory += float64(mem.Value()) / (1024 * 1024 * 1024)
				}
			}
		}
	}

	c.JSON(http.StatusOK, OverviewResponse{
		Nodes:       nodeCount,
		Pods:        podCount,
		Deployments: deploymentCount,
		Services:    serviceCount,
		Namespaces:  len(namespaces.Items),
		Events:      eventSummary,
		Resources: ResourceUsage{
			CPU:    UsageMetric{Used: usedCPU, Total: totalCPU, Unit: "cores"},
			Memory: UsageMetric{Used: usedMemory, Total: totalMemory, Unit: "GB"},
			Pods:   UsageMetric{Used: usedPods, Total: totalPods, Unit: "pods"},
		},
	})
}

// ========== Namespaces ==========

func (h *Handler) ListNamespaces(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetNamespace(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")
	ns, err := h.k8s.Clientset.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ns)
}

func (h *Handler) CreateNamespace(c *gin.Context) {
	ctx := context.Background()
	var ns corev1.Namespace
	if err := c.ShouldBindJSON(&ns); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.k8s.Clientset.CoreV1().Namespaces().Create(ctx, &ns, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) DeleteNamespace(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")
	err := h.k8s.Clientset.CoreV1().Namespaces().Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ========== Pods ==========

func (h *Handler) ListAllPods(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListPods(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetPod(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	pod, err := h.k8s.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pod)
}

func (h *Handler) DeletePod(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.CoreV1().Pods(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) GetPodYAML(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	pod, err := h.k8s.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	// 清理不需要的字段
	pod.ManagedFields = nil
	yamlBytes, err := yaml.Marshal(pod)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(http.StatusOK, string(yamlBytes))
}

func (h *Handler) GetPodLogs(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	container := c.Query("container")
	tailLines := c.DefaultQuery("tailLines", "100")

	opts := &corev1.PodLogOptions{}
	if container != "" {
		opts.Container = container
	}
	if lines, err := strconv.ParseInt(tailLines, 10, 64); err == nil {
		opts.TailLines = &lines
	}

	req := h.k8s.Clientset.CoreV1().Pods(namespace).GetLogs(name, opts)
	logs, err := req.Stream(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer logs.Close()

	logBytes, err := io.ReadAll(logs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(http.StatusOK, string(logBytes))
}

func (h *Handler) GetPodEvents(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")

	fieldSelector := fmt.Sprintf("involvedObject.name=%s,involvedObject.namespace=%s,involvedObject.kind=Pod", name, namespace)
	events, err := h.k8s.Clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: fieldSelector,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: events.Items, Total: len(events.Items)})
}

// ========== Deployments ==========

func (h *Handler) ListAllDeployments(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListDeployments(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetDeployment(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	dep, err := h.k8s.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dep)
}

func (h *Handler) CreateDeployment(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	var dep appsv1.Deployment
	if err := c.ShouldBindJSON(&dep); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.k8s.Clientset.AppsV1().Deployments(namespace).Create(ctx, &dep, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) UpdateDeployment(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	var dep appsv1.Deployment
	if err := c.ShouldBindJSON(&dep); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.k8s.Clientset.AppsV1().Deployments(namespace).Update(ctx, &dep, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) DeleteDeployment(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.AppsV1().Deployments(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) GetDeploymentYAML(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	dep, err := h.k8s.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	dep.ManagedFields = nil
	yamlBytes, err := yaml.Marshal(dep)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(http.StatusOK, string(yamlBytes))
}

func (h *Handler) UpdateDeploymentYAML(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")

	var req struct {
		YAML string `json:"yaml"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var dep appsv1.Deployment
	if err := yaml.Unmarshal([]byte(req.YAML), &dep); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.k8s.Clientset.AppsV1().Deployments(namespace).Update(ctx, &dep, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ScaleDeployment(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")

	var req struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scale, err := h.k8s.Clientset.AppsV1().Deployments(namespace).GetScale(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	scale.Spec.Replicas = req.Replicas
	_, err = h.k8s.Clientset.AppsV1().Deployments(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "scaled", "replicas": req.Replicas})
}

func (h *Handler) RestartDeployment(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")

	dep, err := h.k8s.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// 添加重启注解
	if dep.Spec.Template.Annotations == nil {
		dep.Spec.Template.Annotations = make(map[string]string)
	}
	dep.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	_, err = h.k8s.Clientset.AppsV1().Deployments(namespace).Update(ctx, dep, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "restarted"})
}

func (h *Handler) RollbackDeployment(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")

	var req struct {
		Revision int64 `json:"revision"`
	}
	c.ShouldBindJSON(&req)

	// 获取 ReplicaSets
	dep, err := h.k8s.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	selector, err := metav1.LabelSelectorAsSelector(dep.Spec.Selector)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rsList, err := h.k8s.Clientset.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 找到目标版本的 ReplicaSet
	var targetRS *appsv1.ReplicaSet
	for i := range rsList.Items {
		rs := &rsList.Items[i]
		if revision, ok := rs.Annotations["deployment.kubernetes.io/revision"]; ok {
			if req.Revision == 0 {
				// 回滚到上一个版本
				if targetRS == nil || rs.CreationTimestamp.Before(&targetRS.CreationTimestamp) {
					targetRS = rs
				}
			} else {
				rev, _ := strconv.ParseInt(revision, 10, 64)
				if rev == req.Revision {
					targetRS = rs
					break
				}
			}
		}
	}

	if targetRS == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "revision not found"})
		return
	}

	// 更新 Deployment 的 Pod 模板
	dep.Spec.Template = targetRS.Spec.Template
	_, err = h.k8s.Clientset.AppsV1().Deployments(namespace).Update(ctx, dep, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "rolled back"})
}

func (h *Handler) GetDeploymentPods(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")

	dep, err := h.k8s.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	selector := labels.Set(dep.Spec.Selector.MatchLabels).AsSelector()
	pods, err := h.k8s.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: selector.String(),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: pods.Items, Total: len(pods.Items)})
}

// ========== StatefulSets ==========

func (h *Handler) ListAllStatefulSets(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListStatefulSets(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetStatefulSet(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	sts, err := h.k8s.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sts)
}

func (h *Handler) DeleteStatefulSet(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.AppsV1().StatefulSets(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) GetStatefulSetYAML(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	sts, err := h.k8s.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	sts.ManagedFields = nil
	yamlBytes, err := yaml.Marshal(sts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(http.StatusOK, string(yamlBytes))
}

func (h *Handler) ScaleStatefulSet(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")

	var req struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scale, err := h.k8s.Clientset.AppsV1().StatefulSets(namespace).GetScale(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	scale.Spec.Replicas = req.Replicas
	_, err = h.k8s.Clientset.AppsV1().StatefulSets(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "scaled", "replicas": req.Replicas})
}

// ========== DaemonSets ==========

func (h *Handler) ListAllDaemonSets(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListDaemonSets(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetDaemonSet(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	ds, err := h.k8s.Clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ds)
}

func (h *Handler) DeleteDaemonSet(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.AppsV1().DaemonSets(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) GetDaemonSetYAML(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	ds, err := h.k8s.Clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	ds.ManagedFields = nil
	yamlBytes, err := yaml.Marshal(ds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(http.StatusOK, string(yamlBytes))
}

// ========== Jobs ==========

func (h *Handler) ListAllJobs(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.BatchV1().Jobs("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListJobs(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetJob(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	job, err := h.k8s.Clientset.BatchV1().Jobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, job)
}

func (h *Handler) DeleteJob(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	propagation := metav1.DeletePropagationBackground
	err := h.k8s.Clientset.BatchV1().Jobs(namespace).Delete(ctx, name, metav1.DeleteOptions{
		PropagationPolicy: &propagation,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ========== CronJobs ==========

func (h *Handler) ListAllCronJobs(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.BatchV1().CronJobs("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListCronJobs(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.BatchV1().CronJobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetCronJob(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	cj, err := h.k8s.Clientset.BatchV1().CronJobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cj)
}

func (h *Handler) DeleteCronJob(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.BatchV1().CronJobs(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) TriggerCronJob(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")

	cj, err := h.k8s.Clientset.BatchV1().CronJobs(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// 创建一个新的 Job
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-manual-%d", name, time.Now().Unix()),
			Namespace: namespace,
			Labels:    cj.Spec.JobTemplate.Labels,
			OwnerReferences: []metav1.OwnerReference{
				{
					APIVersion: "batch/v1",
					Kind:       "CronJob",
					Name:       cj.Name,
					UID:        cj.UID,
				},
			},
		},
		Spec: cj.Spec.JobTemplate.Spec,
	}

	result, err := h.k8s.Clientset.BatchV1().Jobs(namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ========== Services ==========

func (h *Handler) ListAllServices(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListServices(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetService(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	svc, err := h.k8s.Clientset.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, svc)
}

func (h *Handler) DeleteService(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.CoreV1().Services(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) GetServiceYAML(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	svc, err := h.k8s.Clientset.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	svc.ManagedFields = nil
	yamlBytes, err := yaml.Marshal(svc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(http.StatusOK, string(yamlBytes))
}

// ========== Ingresses ==========

func (h *Handler) ListAllIngresses(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.NetworkingV1().Ingresses("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListIngresses(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetIngress(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	ing, err := h.k8s.Clientset.NetworkingV1().Ingresses(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ing)
}

func (h *Handler) DeleteIngress(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.NetworkingV1().Ingresses(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ========== ConfigMaps ==========

func (h *Handler) ListAllConfigMaps(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().ConfigMaps("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListConfigMaps(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetConfigMap(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	cm, err := h.k8s.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cm)
}

func (h *Handler) CreateConfigMap(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	var cm corev1.ConfigMap
	if err := c.ShouldBindJSON(&cm); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.k8s.Clientset.CoreV1().ConfigMaps(namespace).Create(ctx, &cm, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) UpdateConfigMap(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	var cm corev1.ConfigMap
	if err := c.ShouldBindJSON(&cm); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.k8s.Clientset.CoreV1().ConfigMaps(namespace).Update(ctx, &cm, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) DeleteConfigMap(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.CoreV1().ConfigMaps(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ========== Secrets ==========

func (h *Handler) ListAllSecrets(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().Secrets("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListSecrets(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetSecret(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	secret, err := h.k8s.Clientset.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, secret)
}

func (h *Handler) CreateSecret(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	var secret corev1.Secret
	if err := c.ShouldBindJSON(&secret); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.k8s.Clientset.CoreV1().Secrets(namespace).Create(ctx, &secret, metav1.CreateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, result)
}

func (h *Handler) UpdateSecret(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	var secret corev1.Secret
	if err := c.ShouldBindJSON(&secret); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.k8s.Clientset.CoreV1().Secrets(namespace).Update(ctx, &secret, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) DeleteSecret(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.CoreV1().Secrets(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ========== PersistentVolumes ==========

func (h *Handler) ListPersistentVolumes(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().PersistentVolumes().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetPersistentVolume(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")
	pv, err := h.k8s.Clientset.CoreV1().PersistentVolumes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pv)
}

func (h *Handler) DeletePersistentVolume(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")
	err := h.k8s.Clientset.CoreV1().PersistentVolumes().Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ========== PersistentVolumeClaims ==========

func (h *Handler) ListAllPersistentVolumeClaims(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().PersistentVolumeClaims("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListPersistentVolumeClaims(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetPersistentVolumeClaim(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	pvc, err := h.k8s.Clientset.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pvc)
}

func (h *Handler) DeletePersistentVolumeClaim(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	name := c.Param("name")
	err := h.k8s.Clientset.CoreV1().PersistentVolumeClaims(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ========== StorageClasses ==========

func (h *Handler) ListStorageClasses(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.StorageV1().StorageClasses().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetStorageClass(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")
	sc, err := h.k8s.Clientset.StorageV1().StorageClasses().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sc)
}

// ========== Nodes ==========

func (h *Handler) ListNodes(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) GetNode(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")
	node, err := h.k8s.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, node)
}

func (h *Handler) GetNodeYAML(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")
	node, err := h.k8s.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	node.ManagedFields = nil
	yamlBytes, err := yaml.Marshal(node)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.String(http.StatusOK, string(yamlBytes))
}

func (h *Handler) GetNodeMetrics(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")

	node, err := h.k8s.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	result := gin.H{
		"name": name,
		"cpu": gin.H{
			"capacity":   node.Status.Allocatable.Cpu().MilliValue(),
			"usage":      0,
			"percentage": 0,
		},
		"memory": gin.H{
			"capacity":   node.Status.Allocatable.Memory().Value(),
			"usage":      0,
			"percentage": 0,
		},
	}

	// 尝试获取 Metrics
	if h.k8s.MetricsClient != nil {
		metrics, err := h.k8s.MetricsClient.MetricsV1beta1().NodeMetricses().Get(ctx, name, metav1.GetOptions{})
		if err == nil {
			cpuUsage := metrics.Usage.Cpu().MilliValue()
			memUsage := metrics.Usage.Memory().Value()
			cpuCapacity := node.Status.Allocatable.Cpu().MilliValue()
			memCapacity := node.Status.Allocatable.Memory().Value()

			result["cpu"] = gin.H{
				"capacity":   cpuCapacity,
				"usage":      cpuUsage,
				"percentage": float64(cpuUsage) / float64(cpuCapacity) * 100,
			}
			result["memory"] = gin.H{
				"capacity":   memCapacity,
				"usage":      memUsage,
				"percentage": float64(memUsage) / float64(memCapacity) * 100,
			}
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetNodePods(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")

	pods, err := h.k8s.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s", name),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: pods.Items, Total: len(pods.Items)})
}

func (h *Handler) CordonNode(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")

	node, err := h.k8s.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	node.Spec.Unschedulable = true
	_, err = h.k8s.Clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "cordoned"})
}

func (h *Handler) UncordonNode(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")

	node, err := h.k8s.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	node.Spec.Unschedulable = false
	_, err = h.k8s.Clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "uncordoned"})
}

func (h *Handler) DrainNode(c *gin.Context) {
	ctx := context.Background()
	name := c.Param("name")

	// 先 cordon
	node, err := h.k8s.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	node.Spec.Unschedulable = true
	_, err = h.k8s.Clientset.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 驱逐 Pods
	pods, err := h.k8s.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s", name),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for _, pod := range pods.Items {
		// 跳过 DaemonSet 管理的 Pod
		skip := false
		for _, ref := range pod.OwnerReferences {
			if ref.Kind == "DaemonSet" {
				skip = true
				break
			}
		}
		if skip {
			continue
		}

		// 删除 Pod（会被控制器重建到其他节点）
		h.k8s.Clientset.CoreV1().Pods(pod.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{})
	}

	c.JSON(http.StatusOK, gin.H{"message": "drained"})
}

// ========== Events ==========

func (h *Handler) ListAllEvents(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListEvents(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

// ========== RBAC ==========

func (h *Handler) ListRoles(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListClusterRoles(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListRoleBindings(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListClusterRoleBindings(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListAllServiceAccounts(c *gin.Context) {
	ctx := context.Background()
	list, err := h.k8s.Clientset.CoreV1().ServiceAccounts("").List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

func (h *Handler) ListServiceAccounts(c *gin.Context) {
	ctx := context.Background()
	namespace := c.Param("ns")
	list, err := h.k8s.Clientset.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ListResponse{Items: list.Items, Total: len(list.Items)})
}

// ========== WebSocket 占位 ==========

func (h *Handler) StreamPodLogs(c *gin.Context) {
	// TODO: 实现 WebSocket 日志流
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

func (h *Handler) ExecPod(c *gin.Context) {
	namespace := c.Query("namespace")
	name := c.Query("name")
	container := c.Query("container")
	command := c.Query("command")

	if namespace == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and name are required"})
		return
	}

	if command == "" {
		command = "/bin/sh"
	}

	// 升级为 WebSocket 连接
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to upgrade websocket: %v", err)})
		return
	}
	defer ws.Close()

	// 创建 exec 请求
	req := h.k8s.Clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(namespace).
		Name(name).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: container,
			Command:   []string{command},
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	// 创建 SPDY executor
	config := h.k8s.Config
	exec, err := remotecommand.NewSPDYExecutor(config, "POST", req.URL())
	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error creating executor: %v\r\n", err)))
		return
	}

	// 创建双向通道
	stdinReader, stdinWriter := io.Pipe()
	stdoutReader, stdoutWriter := io.Pipe()

	// 处理 WebSocket 输入 -> 容器 stdin
	go func() {
		defer stdinWriter.Close()
		for {
			_, message, err := ws.ReadMessage()
			if err != nil {
				return
			}
			stdinWriter.Write(message)
		}
	}()

	// 处理容器 stdout -> WebSocket 输出
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdoutReader.Read(buf)
			if err != nil {
				return
			}
			if n > 0 {
				ws.WriteMessage(websocket.BinaryMessage, buf[:n])
			}
		}
	}()

	// 执行命令
	err = exec.StreamWithContext(context.Background(), remotecommand.StreamOptions{
		Stdin:  stdinReader,
		Stdout: stdoutWriter,
		Stderr: stdoutWriter,
		Tty:    true,
	})

	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\nSession ended: %v\r\n", err)))
	}
}

func (h *Handler) WatchResources(c *gin.Context) {
	// TODO: 实现资源监听
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// ========== VictoriaMetrics 指标 ==========

// GetClusterMetrics 获取集群指标
func (h *Handler) GetClusterMetrics(c *gin.Context) {
	if h.metrics == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "metrics client not configured"})
		return
	}

	metrics, err := h.metrics.GetClusterMetrics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// GetCPUHistory 获取 CPU 历史数据
func (h *Handler) GetCPUHistory(c *gin.Context) {
	if h.metrics == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "metrics client not configured"})
		return
	}

	duration := c.DefaultQuery("duration", "1h")
	step := c.DefaultQuery("step", "1m")

	data, err := h.metrics.GetCPUHistory(duration, step)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetMemoryHistory 获取内存历史数据
func (h *Handler) GetMemoryHistory(c *gin.Context) {
	if h.metrics == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "metrics client not configured"})
		return
	}

	duration := c.DefaultQuery("duration", "1h")
	step := c.DefaultQuery("step", "1m")

	data, err := h.metrics.GetMemoryHistory(duration, step)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// GetNodeMetricsVM 从 VictoriaMetrics 获取节点指标
func (h *Handler) GetNodeMetricsVM(c *gin.Context) {
	if h.metrics == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "metrics client not configured"})
		return
	}

	nodeName := c.Param("name")
	metrics, err := h.metrics.GetNodeMetrics(nodeName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// GetPodMetricsVM 从 VictoriaMetrics 获取 Pod 指标
func (h *Handler) GetPodMetricsVM(c *gin.Context) {
	if h.metrics == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "metrics client not configured"})
		return
	}

	ns := c.Param("ns")
	name := c.Param("name")

	metrics, err := h.metrics.GetPodMetrics(ns, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// ListAllPodMetricsVM 批量获取所有 Pod 的指标
func (h *Handler) ListAllPodMetricsVM(c *gin.Context) {
	if h.metrics == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "metrics client not configured"})
		return
	}

	podMetrics, err := h.metrics.GetAllPodMetrics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": podMetrics,
		"total": len(podMetrics),
	})
}

// ========== Alerts (Alertmanager) ==========

// ListAlerts 获取所有活跃告警
func (h *Handler) ListAlerts(c *gin.Context) {
	if h.alerts == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Alertmanager not configured"})
		return
	}

	alerts, err := h.alerts.GetActiveAlerts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": alerts,
		"total": len(alerts),
	})
}

// GetAlertSummary 获取告警摘要
func (h *Handler) GetAlertSummary(c *gin.Context) {
	if h.alerts == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Alertmanager not configured"})
		return
	}

	summary, err := h.alerts.GetAlertSummary()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// 编译时检查，确保类型实现
var (
	_ = appsv1.Deployment{}
	_ = batchv1.Job{}
	_ = corev1.Pod{}
	_ = networkingv1.Ingress{}
	_ = rbacv1.Role{}
	_ = storagev1.StorageClass{}
)

// ========== 审计日志 ==========

// ListAuditLogs 查询审计日志
func (h *Handler) ListAuditLogs(c *gin.Context) {
	if h.audit == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "审计日志功能未启用"})
		return
	}

	// 解析查询参数
	var params audit.ListParams
	params.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	params.PageSize, _ = strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	params.User = c.Query("user")
	params.Action = c.Query("action")
	params.Resource = c.Query("resource")
	params.Namespace = c.Query("namespace")
	params.Cluster = c.Query("cluster")

	// 解析时间范围
	if startTime := c.Query("startTime"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			params.StartTime = t
		}
	}
	if endTime := c.Query("endTime"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			params.EndTime = t
		}
	}

	result, err := h.audit.List(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetAuditStats 获取审计日志统计
func (h *Handler) GetAuditStats(c *gin.Context) {
	if h.audit == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "审计日志功能未启用"})
		return
	}

	// 默认统计最近 24 小时
	duration := c.DefaultQuery("duration", "24h")
	d, err := time.ParseDuration(duration)
	if err != nil {
		d = 24 * time.Hour
	}

	stats, err := h.audit.GetStats(d)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
