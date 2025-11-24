package model

// ClusterStats represents global cluster metrics
type ClusterStats struct {
	CPUUsage    float64 `json:"cpuUsage"`
	MemoryUsage float64 `json:"memoryUsage"`
	TotalNodes  int     `json:"totalNodes"`
	ActivePods  int     `json:"activePods"`
	FailedPods  int     `json:"failedPods"`
	Errors      int     `json:"errors"`
}

// Node represents a Kubernetes node
type Node struct {
	Name     string            `json:"name"`
	Status   string            `json:"status"`
	Roles    []string          `json:"roles"`
	Capacity map[string]string `json:"capacity"`
	Age      string            `json:"age"`
}

// Pod represents a Kubernetes pod
type Pod struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
	Restarts  int    `json:"restarts"`
	Age       string `json:"age"`
}

// Deployment represents a Kubernetes deployment
type Deployment struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Replicas  string `json:"replicas"`
	Age       string `json:"age"`
}

// Service represents a Kubernetes service
type Service struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Type      string `json:"type"`
	ClusterIP string `json:"clusterIP"`
	Ports     string `json:"ports"`
}

// PodDetail represents detailed information about a pod
type PodDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Status      string            `json:"status"`
	PodIP       string            `json:"podIP"`
	NodeName    string            `json:"nodeName"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
	Containers  []Container       `json:"containers"`
	Volumes     []Volume          `json:"volumes"`
	Conditions  []Condition       `json:"conditions"`
	Events      []Event           `json:"events"`
}

// Container represents a container in a pod
type Container struct {
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	Status  string            `json:"status"`
	Ready   bool              `json:"ready"`
	Restarts int32            `json:"restarts"`
	Ports   []ContainerPort   `json:"ports"`
	Env     []EnvVar          `json:"env"`
	Resources ResourceRequirements `json:"resources"`
}

// ContainerPort represents a port in a container
type ContainerPort struct {
	Name          string `json:"name"`
	ContainerPort int32  `json:"containerPort"`
	Protocol      string `json:"protocol"`
}

// EnvVar represents an environment variable
type EnvVar struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// ResourceRequirements represents resource requests and limits
type ResourceRequirements struct {
	Requests map[string]string `json:"requests"`
	Limits   map[string]string `json:"limits"`
}

// Volume represents a volume in a pod
type Volume struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// Condition represents a pod condition
type Condition struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

// Event represents a Kubernetes event
type Event struct {
	Type      string `json:"type"`
	Reason    string `json:"reason"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}
// SystemInfo represents node system information
type SystemInfo struct {
	MachineID               string `json:"machineID"`
	SystemUUID              string `json:"systemUUID"`
	BootID                  string `json:"bootID"`
	KernelVersion           string `json:"kernelVersion"`
	OSImage                 string `json:"osImage"`
	ContainerRuntimeVersion string `json:"containerRuntimeVersion"`
	KubeletVersion          string `json:"kubeletVersion"`
	KubeProxyVersion        string `json:"kubeProxyVersion"`
	OperatingSystem         string `json:"operatingSystem"`
	Architecture            string `json:"architecture"`
}

// NodeResources represents node resource capacity
type NodeResources struct {
	CPU    string `json:"cpu"`
	Memory string `json:"memory"`
	Pods   string `json:"pods"`
}

// ContainerImage represents a container image on a node
type ContainerImage struct {
	Names     []string `json:"names"`
	SizeBytes int64    `json:"sizeBytes"`
}

// NodeDetail represents detailed information about a node
type NodeDetail struct {
	Name        string            `json:"name"`
	Status      string            `json:"status"`
	Roles       string            `json:"roles"`
	Age         string            `json:"age"`
	Version     string            `json:"version"`
	InternalIP  string            `json:"internalIP"`
	ExternalIP  string            `json:"externalIP"`
	PodCIDR     string            `json:"podCIDR"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	SystemInfo  SystemInfo        `json:"systemInfo"`
	Conditions  []Condition       `json:"conditions"`
	Images      []ContainerImage  `json:"images"`
	Pods        []Pod             `json:"pods"`
	Events      []Event           `json:"events"`
	Resources   NodeResources     `json:"resources"`
}
// StatefulSet represents a Kubernetes StatefulSet
type StatefulSet struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Replicas  string `json:"replicas"`
	Age       string `json:"age"`
}

// DaemonSet represents a Kubernetes DaemonSet
type DaemonSet struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Desired   int32  `json:"desired"`
	Current   int32  `json:"current"`
	Ready     int32  `json:"ready"`
	Age       string `json:"age"`
}

// StatefulSetDetail represents detailed information about a StatefulSet
type StatefulSetDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Replicas    string            `json:"replicas"`
	Age         string            `json:"age"`
	Selector    map[string]string `json:"selector"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Pods        []Pod             `json:"pods"`
	Events      []Event           `json:"events"`
	Images      []string          `json:"images"`
}

// DaemonSetDetail represents detailed information about a DaemonSet
type DaemonSetDetail struct {
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	Desired     int32             `json:"desired"`
	Current     int32             `json:"current"`
	Ready       int32             `json:"ready"`
	Age         string            `json:"age"`
	Selector    map[string]string `json:"selector"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Pods        []Pod             `json:"pods"`
	Events      []Event           `json:"events"`
	Images      []string          `json:"images"`
}
