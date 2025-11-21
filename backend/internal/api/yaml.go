package api

import (
	"context"
	"encoding/json"
	"net/http"

	"k8s-dashboard-backend/internal/k8s"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

// GetPodYAML returns the YAML representation of a pod
func GetPodYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	pod, err := k8s.Clientset.CoreV1().Pods(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pod not found"})
		return
	}

	// Convert to YAML
	yamlData, err := yaml.Marshal(pod)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to YAML"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"yaml": string(yamlData),
	})
}

// UpdatePodYAML updates a pod from YAML
func UpdatePodYAML(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	var request struct {
		YAML string `json:"yaml"`
	}

	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Decode YAML to Pod object
	// We use sigs.k8s.io/yaml to convert YAML to JSON, then unmarshal to Pod
	jsonData, err := yaml.YAMLToJSON([]byte(request.YAML))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid YAML format"})
		return
	}

	var pod corev1.Pod
	if err := json.Unmarshal(jsonData, &pod); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse Pod object"})
		return
	}

	// Ensure namespace and name match URL
	pod.Namespace = namespace
	pod.Name = name

	// Update the pod
	updatedPod, err := k8s.Clientset.CoreV1().Pods(namespace).Update(context.TODO(), &pod, metav1.UpdateOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update pod: " + err.Error()})
		return
	}

	// Convert back to YAML
	updatedYAML, err := yaml.Marshal(updatedPod)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert updated pod to YAML"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"yaml": string(updatedYAML),
	})
}
