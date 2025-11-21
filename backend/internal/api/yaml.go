package api

import (
	"context"
	"net/http"

	"k8s-dashboard-backend/internal/k8s"

	"github.com/gin-gonic/gin"
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
