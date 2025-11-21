package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"k8s-dashboard-backend/internal/k8s"
	"k8s-dashboard-backend/internal/model"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
		cpu := n.Status.Capacity.Cpu().String()
		memory := n.Status.Capacity.Memory().String()
		
		nodeList = append(nodeList, model.Node{
			Name:    n.Name,
			Status:  string(n.Status.Conditions[len(n.Status.Conditions)-1].Type), // Simplified status
			Role:    "worker", // Simplified role detection
			CPU:     cpu,
			Memory:  memory,
			Version: n.Status.NodeInfo.KubeletVersion,
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
