package main

import (
	"log"

	"k8s-dashboard-backend/internal/api"
	"k8s-dashboard-backend/internal/k8s"

	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize Kubernetes Client
	if err := k8s.InitK8sClient(); err != nil {
		log.Fatalf("Failed to initialize Kubernetes client: %v", err)
	}

	r := gin.Default()

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// API Routes
	v1 := r.Group("/api/v1")
	{
		v1.GET("/cluster/stats", api.GetClusterStats)
		v1.GET("/nodes", api.GetNodes)
		v1.GET("/pods", api.GetPods)
		v1.GET("/pods/:namespace/:name", api.GetPodDetail)
		v1.GET("/pods/:namespace/:name/yaml", api.GetPodYAML)
		v1.PUT("/pods/:namespace/:name/yaml", api.UpdatePodYAML)
		v1.GET("/pods/:namespace/:name/logs", api.HandleLogStream)
		v1.GET("/pods/:namespace/:name/terminal", api.HandleTerminal)
		v1.GET("/pods/:namespace/:name/metrics", api.GetPodMetrics)
		v1.GET("/deployments", api.GetDeployments)
		v1.GET("/deployments/:namespace/:name", api.GetDeploymentDetail)
		v1.GET("/deployments/:namespace/:name/yaml", api.GetDeploymentYAML)
		v1.PUT("/deployments/:namespace/:name/yaml", api.UpdateDeploymentYAML)
		v1.GET("/statefulsets", api.GetStatefulSets)
		v1.GET("/statefulsets/:namespace/:name", api.GetStatefulSetDetail)
		v1.GET("/statefulsets/:namespace/:name/yaml", api.GetStatefulSetYAML)
		v1.PUT("/statefulsets/:namespace/:name/yaml", api.UpdateStatefulSetYAML)
		v1.GET("/daemonsets", api.GetDaemonSets)
		v1.GET("/daemonsets/:namespace/:name", api.GetDaemonSetDetail)
		v1.GET("/daemonsets/:namespace/:name/yaml", api.GetDaemonSetYAML)
		v1.PUT("/daemonsets/:namespace/:name/yaml", api.UpdateDaemonSetYAML)
		v1.GET("/services", api.GetServices)
		v1.GET("/nodes/:name", api.GetNodeDetail)
		v1.GET("/nodes/:name/metrics", api.GetNodeMetrics)
		v1.GET("/metrics/nodes", api.GetAllNodeMetrics)
		
		// Action routes
		v1.PUT("/deployments/:namespace/:name/scale", api.ScaleDeployment)
		v1.POST("/deployments/:namespace/:name/redeploy", api.RedeployDeployment)
		v1.DELETE("/deployments/:namespace/:name", api.DeleteDeployment)
		v1.PUT("/statefulsets/:namespace/:name/scale", api.ScaleStatefulSet)
		v1.DELETE("/statefulsets/:namespace/:name", api.DeleteStatefulSet)
		v1.DELETE("/daemonsets/:namespace/:name", api.DeleteDaemonSet)
	}

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
