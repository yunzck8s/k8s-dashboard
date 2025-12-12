package observation

// PromQL 查询语句

// Pod 异常状态查询
const (
	// QueryCrashLoopBackOff 查询处于 CrashLoopBackOff 状态的 Pod
	QueryCrashLoopBackOff = `kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} > 0`

	// QueryOOMKilled 查询最近 1 小时内发生过 OOMKilled 的 Pod
	QueryOOMKilled = `increase(kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}[1h]) > 0`

	// QueryImagePullBackOff 查询处于 ImagePullBackOff 或 ErrImagePull 状态的 Pod
	QueryImagePullBackOff = `kube_pod_container_status_waiting_reason{reason=~"ImagePullBackOff|ErrImagePull"} > 0`

	// QueryPodPending 查询处于 Pending 状态超过 5 分钟的 Pod
	QueryPodPending = `kube_pod_status_phase{phase="Pending"} == 1`

	// QueryContainerCreating 查询处于 ContainerCreating 状态的 Pod
	QueryContainerCreating = `kube_pod_container_status_waiting_reason{reason="ContainerCreating"} > 0`
)

// 节点异常状态查询
const (
	// QueryNodeNotReady 查询非 Ready 状态的节点
	QueryNodeNotReady = `kube_node_status_condition{condition="Ready",status!="true"} == 1`

	// QueryNodeMemoryPressure 查询内存压力的节点
	QueryNodeMemoryPressure = `kube_node_status_condition{condition="MemoryPressure",status="true"} == 1`

	// QueryNodeDiskPressure 查询磁盘压力的节点
	QueryNodeDiskPressure = `kube_node_status_condition{condition="DiskPressure",status="true"} == 1`

	// QueryNodePIDPressure 查询 PID 压力的节点
	QueryNodePIDPressure = `kube_node_status_condition{condition="PIDPressure",status="true"} == 1`

	// QueryNodePodsCount 查询节点上的 Pod 数量
	QueryNodePodsCount = `count by (node) (kube_pod_info)`
)

// 资源超限查询（默认阈值 80%）
const (
	// QueryHighCPUPods 查询 CPU 使用率超过限制 80% 的 Pod
	QueryHighCPUPods = `(
		sum by (namespace, pod) (rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m]))
		/
		sum by (namespace, pod) (kube_pod_container_resource_limits{resource="cpu"})
	) > 0.8`

	// QueryHighMemoryPods 查询内存使用率超过限制 80% 的 Pod
	QueryHighMemoryPods = `(
		sum by (namespace, pod) (container_memory_working_set_bytes{container!="",container!="POD"})
		/
		sum by (namespace, pod) (kube_pod_container_resource_limits{resource="memory"})
	) > 0.8`

	// QueryHighCPUNodes 查询 CPU 使用率超过 80% 的节点
	QueryHighCPUNodes = `(
		1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))
	) > 0.8`

	// QueryHighMemoryNodes 查询内存使用率超过 80% 的节点
	QueryHighMemoryNodes = `(
		1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)
	) > 0.8`

	// QueryHighDiskNodes 查询磁盘使用率超过 85% 的节点
	QueryHighDiskNodes = `(
		1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})
	) > 0.85`
)

// 资源趋势查询
const (
	// QueryCPUUsageTrend 集群 CPU 使用量趋势
	QueryCPUUsageTrend = `sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m]))`

	// QueryMemoryUsageTrend 集群内存使用量趋势（GB）
	QueryMemoryUsageTrend = `sum(container_memory_working_set_bytes{container!="",container!="POD"}) / 1024 / 1024 / 1024`

	// QueryCPUUsagePercent 集群 CPU 使用率趋势
	QueryCPUUsagePercent = `sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m])) / sum(kube_node_status_allocatable{resource="cpu"}) * 100`

	// QueryMemoryUsagePercent 集群内存使用率趋势
	QueryMemoryUsagePercent = `sum(container_memory_working_set_bytes{container!="",container!="POD"}) / sum(kube_node_status_allocatable{resource="memory"}) * 100`
)

// Pod 重启趋势查询
const (
	// QueryPodRestarts 查询 Pod 重启次数
	QueryPodRestarts = `sum(increase(kube_pod_container_status_restarts_total[1h]))`

	// QueryPodRestartsByNamespace 按命名空间分组的 Pod 重启次数
	QueryPodRestartsByNamespace = `sum by (namespace) (increase(kube_pod_container_status_restarts_total[1h]))`

	// QueryPodRestartsByPod 按 Pod 分组的重启次数
	QueryPodRestartsByPod = `sum by (namespace, pod) (increase(kube_pod_container_status_restarts_total[1h]))`

	// QueryTopRestartingPods 重启次数最多的 Pod（Top 10）
	QueryTopRestartingPods = `topk(10, sum by (namespace, pod) (increase(kube_pod_container_status_restarts_total[24h])))`
)

// 告警相关查询
const (
	// QueryActiveAlerts 活跃告警数量
	QueryActiveAlerts = `count(ALERTS{alertstate="firing"})`

	// QueryAlertsByNamespace 按命名空间分组的告警数量
	QueryAlertsByNamespace = `count by (namespace) (ALERTS{alertstate="firing"})`

	// QueryAlertsBySeverity 按严重程度分组的告警数量
	QueryAlertsBySeverity = `count by (severity) (ALERTS{alertstate="firing"})`
)

// 同比环比查询辅助
const (
	// QueryOffsetWeek 周环比偏移量
	QueryOffsetWeek = "7d"

	// QueryOffsetMonth 月同比偏移量
	QueryOffsetMonth = "30d"
)

// BuildQueryWithOffset 构建带偏移量的查询
func BuildQueryWithOffset(query string, offset string) string {
	return query + " offset " + offset
}

// BuildRangeQuery 构建范围查询
func BuildRangeQuery(query string, start, end, step string) map[string]string {
	return map[string]string{
		"query": query,
		"start": start,
		"end":   end,
		"step":  step,
	}
}
