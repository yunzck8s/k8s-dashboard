package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"k8s-dashboard-backend/internal/k8s"
	"k8s-dashboard-backend/internal/model"

	"github.com/gin-gonic/gin"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

func GetClusterStats(c *gin.Context) {
	nodes, err := k8s.Clientset.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pods, err := k8s.Clientset.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}


	activePods := 0
	failedPods := 0
	for _, pod := range pods.Items {
		// Check container statuses for actual failure states
		isFailed := false
		if pod.Status.Phase == "Failed" {
			isFailed = true
		} else {
			// Check if any container is in a failed state
			for _, cs := range pod.Status.ContainerStatuses {
				if cs.State.Waiting != nil && 
				   (cs.State.Waiting.Reason == "CrashLoopBackOff" || 
				    cs.State.Waiting.Reason == "ErrImagePull" || 
				    cs.State.Waiting.Reason == "ImagePullBackOff" ||
				    cs.State.Waiting.Reason == "Error") {
					isFailed = true
					break
				}
				if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
					isFailed = true
					break
				}
			}
		}
		
		if isFailed {
			failedPods++
		} else if pod.Status.Phase == "Running" || pod.Status.Phase == "Pending" || pod.Status.Phase == "Succeeded" {
			activePods++
		}
	}

	// Calculate real CPU and Memory usage from Metrics Server
	var cpuUsage, memoryUsage float64
	
	// Get node metrics
	nodeMetrics, err := k8s.MetricsClient.MetricsV1beta1().NodeMetricses().List(context.TODO(), metav1.ListOptions{})
	if err == nil && len(nodeMetrics.Items) > 0 {
		var totalCPUCapacity, totalMemoryCapacity, totalCPUUsage, totalMemoryUsage int64
		
		// Calculate total capacity
		for _, node := range nodes.Items {
			totalCPUCapacity += node.Status.Capacity.Cpu().MilliValue()
			totalMemoryCapacity += node.Status.Capacity.Memory().Value()
		}
		
		// Calculate total usage
		for _, metric := range nodeMetrics.Items {
			totalCPUUsage += metric.Usage.Cpu().MilliValue()
			totalMemoryUsage += metric.Usage.Memory().Value()
		}
		
		// Calculate percentages
		if totalCPUCapacity > 0 {
			cpuUsage = float64(totalCPUUsage) / float64(totalCPUCapacity) * 100
		}
		if totalMemoryCapacity > 0 {
			memoryUsage = float64(totalMemoryUsage) / float64(totalMemoryCapacity) * 100
		}
	} else {
		// Fallback to mock data if Metrics Server is unavailable
		cpuUsage = 0
		memoryUsage = 0
	}

	stats := model.ClusterStats{
		CPUUsage:    cpuUsage,
		MemoryUsage: memoryUsage,
		TotalNodes:  len(nodes.Items),
		ActivePods:  activePods,
		FailedPods:  failedPods,
		Errors:      0,
	}

	c.JSON(http.StatusOK, stats)
}

func GetNodes(c *gin.Context) {
	nodes, err := k8s.Clientset.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nodeList []model.Node
	for _, n := range nodes.Items {
		// Extract roles from labels
		roles := []string{}
		if _, ok := n.Labels["node-role.kubernetes.io/control-plane"]; ok {
			roles = append(roles, "control-plane")
		}
		if _, ok := n.Labels["node-role.kubernetes.io/master"]; ok {
			roles = append(roles, "master")
		}
		if len(roles) == 0 {
			roles = append(roles, "worker")
		}

		// Get status
		status := "NotReady"
		for _, cond := range n.Status.Conditions {
			if cond.Type == "Ready" {
				if cond.Status == "True" {
					status = "Ready"
				}
				break
			}
		}

		// Calculate age
		age := time.Since(n.CreationTimestamp.Time).Round(time.Hour).String()

		nodeList = append(nodeList, model.Node{
			Name:   n.Name,
			Status: status,
			Roles:  roles,
			Capacity: map[string]string{
				"cpu":    n.Status.Capacity.Cpu().String(),
				"memory": n.Status.Capacity.Memory().String(),
			},
			Age: age,
		})
	}

	c.JSON(http.StatusOK, nodeList)
}

func GetPods(c *gin.Context) {
	pods, err := k8s.Clientset.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var podList []model.Pod
	for _, p := range pods.Items {
		age := time.Since(p.CreationTimestamp.Time).Round(time.Minute).String()
		restarts := 0
		status := string(p.Status.Phase)

		// Check for more specific status (e.g., CrashLoopBackOff, ErrImagePull)
		// Priority: Terminating > Waiting (Error) > Terminated (Error) > Phase
		if p.DeletionTimestamp != nil {
			status = "Terminating"
		} else {
			for _, cs := range p.Status.ContainerStatuses {
				restarts += int(cs.RestartCount)
				if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
					status = cs.State.Waiting.Reason
					break // Found a specific waiting reason (usually error), prioritize it
				} else if cs.State.Terminated != nil && cs.State.Terminated.Reason != "" && cs.State.Terminated.ExitCode != 0 {
					status = cs.State.Terminated.Reason
					// Don't break yet, Waiting might be more current/important
				}
			}
		}

		podList = append(podList, model.Pod{
			Name:      p.Name,
			Namespace: p.Namespace,
			Status:    status,
			Restarts:  restarts,
			Age:       age,
		})
	}

	c.JSON(http.StatusOK, podList)
}

func GetDeployments(c *gin.Context) {
	deployments, err := k8s.Clientset.AppsV1().Deployments("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var deployList []model.Deployment
	for _, d := range deployments.Items {
		age := time.Since(d.CreationTimestamp.Time).Round(time.Hour).String()
		replicas := fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, *d.Spec.Replicas)

		deployList = append(deployList, model.Deployment{
			Name:      d.Name,
			Namespace: d.Namespace,
			Replicas:  replicas,
			Age:       age,
		})
	}

	c.JSON(http.StatusOK, deployList)
}

func GetServices(c *gin.Context) {
	services, err := k8s.Clientset.CoreV1().Services("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var svcList []model.Service
	for _, s := range services.Items {
		ports := ""
		if len(s.Spec.Ports) > 0 {
			ports = fmt.Sprintf("%d/%s", s.Spec.Ports[0].Port, s.Spec.Ports[0].Protocol)
		}

		svcList = append(svcList, model.Service{
			Name:      s.Name,
			Namespace: s.Namespace,
			Type:      string(s.Spec.Type),
			ClusterIP: s.Spec.ClusterIP,
			Ports:     ports,
		})
	}

	c.JSON(http.StatusOK, svcList)
}

// GetPodDetail returns detailed information about a specific pod
func GetPodDetail(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	pod, err := k8s.Clientset.CoreV1().Pods(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pod not found"})
		return
	}

	// Get pod events
	events, _ := k8s.Clientset.CoreV1().Events(namespace).List(context.TODO(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s", name),
	})

	var eventList []model.Event
	for _, e := range events.Items {
		eventList = append(eventList, model.Event{
			Type:      e.Type,
			Reason:    e.Reason,
			Message:   e.Message,
			Timestamp: e.LastTimestamp.Format(time.RFC3339),
		})
	}

	// Build container list
	var containers []model.Container
	for i, c := range pod.Spec.Containers {
		status := "Waiting"
		ready := false
		restarts := int32(0)

		if i < len(pod.Status.ContainerStatuses) {
			cs := pod.Status.ContainerStatuses[i]
			ready = cs.Ready
			restarts = cs.RestartCount
			if cs.State.Running != nil {
				status = "Running"
			} else if cs.State.Terminated != nil {
				status = "Terminated"
			}
		}

		var ports []model.ContainerPort
		for _, p := range c.Ports {
			ports = append(ports, model.ContainerPort{
				Name:          p.Name,
				ContainerPort: p.ContainerPort,
				Protocol:      string(p.Protocol),
			})
		}

		var env []model.EnvVar
		for _, e := range c.Env {
			env = append(env, model.EnvVar{
				Name:  e.Name,
				Value: e.Value,
			})
		}

		requests := make(map[string]string)
		limits := make(map[string]string)
		if c.Resources.Requests != nil {
			for k, v := range c.Resources.Requests {
				requests[string(k)] = v.String()
			}
		}
		if c.Resources.Limits != nil {
			for k, v := range c.Resources.Limits {
				limits[string(k)] = v.String()
			}
		}

		containers = append(containers, model.Container{
			Name:     c.Name,
			Image:    c.Image,
			Status:   status,
			Ready:    ready,
			Restarts: restarts,
			Ports:    ports,
			Env:      env,
			Resources: model.ResourceRequirements{
				Requests: requests,
				Limits:   limits,
			},
		})
	}

	// Build volume list
	var volumes []model.Volume
	for _, v := range pod.Spec.Volumes {
		volumeType := "Unknown"
		if v.EmptyDir != nil {
			volumeType = "EmptyDir"
		} else if v.HostPath != nil {
			volumeType = "HostPath"
		} else if v.PersistentVolumeClaim != nil {
			volumeType = "PersistentVolumeClaim"
		} else if v.ConfigMap != nil {
			volumeType = "ConfigMap"
		} else if v.Secret != nil {
			volumeType = "Secret"
		}

		volumes = append(volumes, model.Volume{
			Name: v.Name,
			Type: volumeType,
		})
	}

	// Build condition list
	var conditions []model.Condition
	for _, c := range pod.Status.Conditions {
		conditions = append(conditions, model.Condition{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}

	detail := model.PodDetail{
		Name:        pod.Name,
		Namespace:   pod.Namespace,
		Status:      string(pod.Status.Phase),
		PodIP:       pod.Status.PodIP,
		NodeName:    pod.Spec.NodeName,
		Labels:      pod.Labels,
		Annotations: pod.Annotations,
		CreatedAt:   pod.CreationTimestamp.Format(time.RFC3339),
		Containers:  containers,
		Volumes:     volumes,
		Conditions:  conditions,
		Events:      eventList,
	}

	c.JSON(http.StatusOK, detail)
}
// GetNodeDetail returns detailed information about a specific node
func GetNodeDetail(c *gin.Context) {
	name := c.Param("name")

	node, err := k8s.Clientset.CoreV1().Nodes().Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}

	// Get pods running on this node
	pods, err := k8s.Clientset.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s", name),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to fetch pods: %v", err)})
		return
	}

	// Get events related to this node
	events, _ := k8s.Clientset.CoreV1().Events("").List(context.TODO(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=Node", name),
	})

	// Process Pods
	var podList []model.Pod
	for _, p := range pods.Items {
		age := time.Since(p.CreationTimestamp.Time).Round(time.Minute).String()
		restarts := 0
		status := string(p.Status.Phase)

		for _, cs := range p.Status.ContainerStatuses {
			restarts += int(cs.RestartCount)
			if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
				status = cs.State.Waiting.Reason
				break
			} else if cs.State.Terminated != nil && cs.State.Terminated.Reason != "" && cs.State.Terminated.ExitCode != 0 {
				status = cs.State.Terminated.Reason
			}
		}

		podList = append(podList, model.Pod{
			Name:      p.Name,
			Namespace: p.Namespace,
			Status:    status,
			Restarts:  restarts,
			Age:       age,
		})
	}

	// Process Events
	var eventList []model.Event
	if events != nil {
		for _, e := range events.Items {
			eventList = append(eventList, model.Event{
				Type:      e.Type,
				Reason:    e.Reason,
				Message:   e.Message,
				Timestamp: e.LastTimestamp.Format(time.RFC3339),
			})
		}
	}

	// Process Conditions
	var conditions []model.Condition
	for _, c := range node.Status.Conditions {
		conditions = append(conditions, model.Condition{
			Type:    string(c.Type),
			Status:  string(c.Status),
			Reason:  c.Reason,
			Message: c.Message,
		})
	}

	// Process System Info
	sysInfo := model.SystemInfo{
		MachineID:               node.Status.NodeInfo.MachineID,
		SystemUUID:              node.Status.NodeInfo.SystemUUID,
		BootID:                  node.Status.NodeInfo.BootID,
		KernelVersion:           node.Status.NodeInfo.KernelVersion,
		OSImage:                 node.Status.NodeInfo.OSImage,
		ContainerRuntimeVersion: node.Status.NodeInfo.ContainerRuntimeVersion,
		KubeletVersion:          node.Status.NodeInfo.KubeletVersion,
		KubeProxyVersion:        node.Status.NodeInfo.KubeProxyVersion,
		OperatingSystem:         node.Status.NodeInfo.OperatingSystem,
		Architecture:            node.Status.NodeInfo.Architecture,
	}

	// Calculate Resources
	cpuCapacity := node.Status.Capacity.Cpu().String()
	memoryCapacity := node.Status.Capacity.Memory().String()
	podCapacity := node.Status.Capacity.Pods().String()

	detail := model.NodeDetail{
		Name:        node.Name,
		Status:      string(node.Status.Conditions[len(node.Status.Conditions)-1].Type), // Simplified
		Roles:       "worker", // Simplified
		Age:         time.Since(node.CreationTimestamp.Time).Round(time.Hour).String(),
		Version:     node.Status.NodeInfo.KubeletVersion,
		InternalIP:  getInternalIP(node),
		ExternalIP:  getExternalIP(node),
		PodCIDR:     node.Spec.PodCIDR,
		Labels:      node.Labels,
		Annotations: node.Annotations,
		SystemInfo:  sysInfo,
		Conditions:  conditions,
		Images:      []model.ContainerImage{}, // Placeholder if needed
		Pods:        podList,
		Events:      eventList,
		Resources: model.NodeResources{
			CPU:    cpuCapacity,
			Memory: memoryCapacity,
			Pods:   podCapacity,
		},
	}

	c.JSON(http.StatusOK, detail)
}

func getInternalIP(node *corev1.Node) string {
	for _, addr := range node.Status.Addresses {
		if addr.Type == corev1.NodeInternalIP {
			return addr.Address
		}
	}
	return ""
}

func getExternalIP(node *corev1.Node) string {
	for _, addr := range node.Status.Addresses {
		if addr.Type == corev1.NodeExternalIP {
			return addr.Address
		}
	}
	return ""
}
// GetStatefulSets returns a list of all StatefulSets
func GetStatefulSets(c *gin.Context) {
	stsList, err := k8s.Clientset.AppsV1().StatefulSets("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var list []model.StatefulSet
	for _, s := range stsList.Items {
		age := time.Since(s.CreationTimestamp.Time).Round(time.Hour).String()
		replicas := fmt.Sprintf("%d/%d", s.Status.ReadyReplicas, *s.Spec.Replicas)

		list = append(list, model.StatefulSet{
			Name:      s.Name,
			Namespace: s.Namespace,
			Replicas:  replicas,
			Age:       age,
		})
	}

	c.JSON(http.StatusOK, list)
}

// GetDaemonSets returns a list of all DaemonSets
func GetDaemonSets(c *gin.Context) {
	dsList, err := k8s.Clientset.AppsV1().DaemonSets("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var list []model.DaemonSet
	for _, d := range dsList.Items {
		age := time.Since(d.CreationTimestamp.Time).Round(time.Hour).String()

		list = append(list, model.DaemonSet{
			Name:      d.Name,
			Namespace: d.Namespace,
			Desired:   d.Status.DesiredNumberScheduled,
			Current:   d.Status.CurrentNumberScheduled,
			Ready:     d.Status.NumberReady,
			Age:       age,
		})
	}

	c.JSON(http.StatusOK, list)
}

// GetStatefulSetDetail returns detailed information about a specific StatefulSet
func GetStatefulSetDetail(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	sts, err := k8s.Clientset.AppsV1().StatefulSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "StatefulSet not found"})
		return
	}

	// Get pods
	labelSelector := metav1.FormatLabelSelector(sts.Spec.Selector)
	pods, err := k8s.Clientset.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: labelSelector,
	})

	var podList []model.Pod
	if err == nil {
		for _, p := range pods.Items {
			age := time.Since(p.CreationTimestamp.Time).Round(time.Minute).String()
			restarts := 0
			status := string(p.Status.Phase)
			for _, cs := range p.Status.ContainerStatuses {
				restarts += int(cs.RestartCount)
			}
			podList = append(podList, model.Pod{
				Name:      p.Name,
				Namespace: p.Namespace,
				Status:    status,
				Restarts:  restarts,
				Age:       age,
			})
		}
	}

	// Get events
	events, _ := k8s.Clientset.CoreV1().Events(namespace).List(context.TODO(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=StatefulSet", name),
	})

	var eventList []model.Event
	if events != nil {
		for _, e := range events.Items {
			eventList = append(eventList, model.Event{
				Type:      e.Type,
				Reason:    e.Reason,
				Message:   e.Message,
				Timestamp: e.LastTimestamp.Format(time.RFC3339),
			})
		}
	}

	var images []string
	for _, c := range sts.Spec.Template.Spec.Containers {
		images = append(images, c.Image)
	}

	detail := model.StatefulSetDetail{
		Name:        sts.Name,
		Namespace:   sts.Namespace,
		Replicas:    fmt.Sprintf("%d/%d", sts.Status.ReadyReplicas, *sts.Spec.Replicas),
		Age:         time.Since(sts.CreationTimestamp.Time).Round(time.Hour).String(),
		Selector:    sts.Spec.Selector.MatchLabels,
		Labels:      sts.Labels,
		Annotations: sts.Annotations,
		Pods:        podList,
		Events:      eventList,
		Images:      images,
	}

	c.JSON(http.StatusOK, detail)
}

// GetDaemonSetDetail returns detailed information about a specific DaemonSet
func GetDaemonSetDetail(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	ds, err := k8s.Clientset.AppsV1().DaemonSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "DaemonSet not found"})
		return
	}

	// Get pods
	labelSelector := metav1.FormatLabelSelector(ds.Spec.Selector)
	pods, err := k8s.Clientset.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: labelSelector,
	})

	var podList []model.Pod
	if err == nil {
		for _, p := range pods.Items {
			age := time.Since(p.CreationTimestamp.Time).Round(time.Minute).String()
			restarts := 0
			status := string(p.Status.Phase)
			for _, cs := range p.Status.ContainerStatuses {
				restarts += int(cs.RestartCount)
			}
			podList = append(podList, model.Pod{
				Name:      p.Name,
				Namespace: p.Namespace,
				Status:    status,
				Restarts:  restarts,
				Age:       age,
			})
		}
	}

	// Get events
	events, _ := k8s.Clientset.CoreV1().Events(namespace).List(context.TODO(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=DaemonSet", name),
	})

	var eventList []model.Event
	if events != nil {
		for _, e := range events.Items {
			eventList = append(eventList, model.Event{
				Type:      e.Type,
				Reason:    e.Reason,
				Message:   e.Message,
				Timestamp: e.LastTimestamp.Format(time.RFC3339),
			})
		}
	}

	var images []string
	for _, c := range ds.Spec.Template.Spec.Containers {
		images = append(images, c.Image)
	}

	detail := model.DaemonSetDetail{
		Name:        ds.Name,
		Namespace:   ds.Namespace,
		Desired:     ds.Status.DesiredNumberScheduled,
		Current:     ds.Status.CurrentNumberScheduled,
		Ready:       ds.Status.NumberReady,
		Age:         time.Since(ds.CreationTimestamp.Time).Round(time.Hour).String(),
		Selector:    ds.Spec.Selector.MatchLabels,
		Labels:      ds.Labels,
		Annotations: ds.Annotations,
		Pods:        podList,
		Events:      eventList,
		Images:      images,
	}

	c.JSON(http.StatusOK, detail)
}
// GetDeploymentYAML returns the YAML representation of a Deployment
func GetDeploymentYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	deployment, err := k8s.Clientset.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	// Remove managed fields to make YAML cleaner
	deployment.ManagedFields = nil

	y, err := yaml.Marshal(deployment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal YAML"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"yaml": string(y)})
}

// UpdateDeploymentYAML updates a Deployment from YAML
func UpdateDeploymentYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Yaml string `json:"yaml"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var deployment appsv1.Deployment
	if err := yaml.Unmarshal([]byte(req.Yaml), &deployment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid YAML"})
		return
	}

	// Ensure namespace and name match
	deployment.Namespace = namespace
	deployment.Name = name

	_, err := k8s.Clientset.AppsV1().Deployments(namespace).Update(context.TODO(), &deployment, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// GetStatefulSetYAML returns the YAML representation of a StatefulSet
func GetStatefulSetYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	sts, err := k8s.Clientset.AppsV1().StatefulSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "StatefulSet not found"})
		return
	}

	sts.ManagedFields = nil

	y, err := yaml.Marshal(sts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal YAML"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"yaml": string(y)})
}

// UpdateStatefulSetYAML updates a StatefulSet from YAML
func UpdateStatefulSetYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Yaml string `json:"yaml"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var sts appsv1.StatefulSet
	if err := yaml.Unmarshal([]byte(req.Yaml), &sts); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid YAML"})
		return
	}

	sts.Namespace = namespace
	sts.Name = name

	_, err := k8s.Clientset.AppsV1().StatefulSets(namespace).Update(context.TODO(), &sts, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// GetDaemonSetYAML returns the YAML representation of a DaemonSet
func GetDaemonSetYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	ds, err := k8s.Clientset.AppsV1().DaemonSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "DaemonSet not found"})
		return
	}

	ds.ManagedFields = nil

	y, err := yaml.Marshal(ds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal YAML"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"yaml": string(y)})
}

// UpdateDaemonSetYAML updates a DaemonSet from YAML
func UpdateDaemonSetYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Yaml string `json:"yaml"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var ds appsv1.DaemonSet
	if err := yaml.Unmarshal([]byte(req.Yaml), &ds); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid YAML"})
		return
	}

	ds.Namespace = namespace
	ds.Name = name

	_, err := k8s.Clientset.AppsV1().DaemonSets(namespace).Update(context.TODO(), &ds, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// ScaleDeployment scales a deployment to the specified number of replicas
func ScaleDeployment(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	deployment, err := k8s.Clientset.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	deployment.Spec.Replicas = &req.Replicas

	_, err = k8s.Clientset.AppsV1().Deployments(namespace).Update(context.TODO(), deployment, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "scaled", "replicas": req.Replicas})
}

// RedeployDeployment restarts a deployment by adding an annotation
func RedeployDeployment(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	deployment, err := k8s.Clientset.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	// Add restart annotation to force redeploy
	if deployment.Spec.Template.Annotations == nil {
		deployment.Spec.Template.Annotations = make(map[string]string)
	}
	deployment.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = time.Now().Format(time.RFC3339)

	_, err = k8s.Clientset.AppsV1().Deployments(namespace).Update(context.TODO(), deployment, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "redeployed"})
}

// DeleteDeployment deletes a deployment
func DeleteDeployment(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	err := k8s.Clientset.AppsV1().Deployments(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ScaleStatefulSet scales a statefulset to the specified number of replicas
func ScaleStatefulSet(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	sts, err := k8s.Clientset.AppsV1().StatefulSets(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "StatefulSet not found"})
		return
	}

	sts.Spec.Replicas = &req.Replicas

	_, err = k8s.Clientset.AppsV1().StatefulSets(namespace).Update(context.TODO(), sts, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "scaled", "replicas": req.Replicas})
}

// DeleteStatefulSet deletes a statefulset
func DeleteStatefulSet(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	err := k8s.Clientset.AppsV1().StatefulSets(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// DeleteDaemonSet deletes a daemonset
func DeleteDaemonSet(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	err := k8s.Clientset.AppsV1().DaemonSets(namespace).Delete(context.TODO(), name, metav1.DeleteOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
