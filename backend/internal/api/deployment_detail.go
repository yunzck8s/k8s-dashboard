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

func GetDeploymentDetail(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Get deployment
	deployment, err := k8s.Clientset.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	// Get related pods using label selector
	labelSelector := metav1.FormatLabelSelector(deployment.Spec.Selector)
	pods, err := k8s.Clientset.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: labelSelector,
	})

	var podList []model.Pod
	if err == nil {
		for _, p := range pods.Items {
			age := time.Since(p.CreationTimestamp.Time).Round(time.Minute).String()
			restarts := 0
			status := string(p.Status.Phase)

			// Check for more specific status
			if p.DeletionTimestamp != nil {
				status = "Terminating"
			} else {
				for _, cs := range p.Status.ContainerStatuses {
					restarts += int(cs.RestartCount)
					if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
						status = cs.State.Waiting.Reason
						break
					}
					if cs.State.Terminated != nil && cs.State.Terminated.ExitCode != 0 {
						status = cs.State.Terminated.Reason
						break
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
	}

	// Get ReplicaSets
	replicaSets, err := k8s.Clientset.AppsV1().ReplicaSets(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: labelSelector,
	})

	var rsList []map[string]interface{}
	if err == nil {
		for _, rs := range replicaSets.Items {
			age := time.Since(rs.CreationTimestamp.Time).Round(time.Minute).String()
			rsList = append(rsList, map[string]interface{}{
				"name":     rs.Name,
				"replicas": fmt.Sprintf("%d/%d", rs.Status.ReadyReplicas, *rs.Spec.Replicas),
				"age":      age,
			})
		}
	}

	// Get events
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

	// Extract image from first container
	image := ""
	if len(deployment.Spec.Template.Spec.Containers) > 0 {
		image = deployment.Spec.Template.Spec.Containers[0].Image
	}

	// Build response
	detail := map[string]interface{}{
		"name":      deployment.Name,
		"namespace": deployment.Namespace,
		"replicas": map[string]interface{}{
			"desired":   *deployment.Spec.Replicas,
			"ready":     deployment.Status.ReadyReplicas,
			"available": deployment.Status.AvailableReplicas,
			"updated":   deployment.Status.UpdatedReplicas,
		},
		"image":      image,
		"strategy":   deployment.Spec.Strategy.Type,
		"labels":     deployment.Labels,
		"createdAt":  deployment.CreationTimestamp.Format(time.RFC3339),
		"pods":       podList,
		"replicaSets": rsList,
		"events":     eventList,
	}

	c.JSON(http.StatusOK, detail)
}
