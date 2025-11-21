package api

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"strconv"

	"k8s-dashboard-backend/internal/k8s"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// HandleLogStream handles WebSocket connections for streaming pod logs
func HandleLogStream(c *gin.Context) {
	namespace := c.Param("namespace")
	podName := c.Param("name")
	container := c.Query("container")
	followStr := c.DefaultQuery("follow", "true")
	tailLinesStr := c.DefaultQuery("tailLines", "100")
	timestampsStr := c.DefaultQuery("timestamps", "false")

	// Parse query parameters
	follow, _ := strconv.ParseBool(followStr)
	tailLines, err := strconv.ParseInt(tailLinesStr, 10, 64)
	if err != nil {
		tailLines = 100
	}
	timestamps, _ := strconv.ParseBool(timestampsStr)

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade to WebSocket"})
		return
	}
	defer ws.Close()

	// Get pod to verify it exists and get container info
	pod, err := k8s.Clientset.CoreV1().Pods(namespace).Get(context.TODO(), podName, metav1.GetOptions{})
	if err != nil {
		ws.WriteJSON(map[string]string{
			"type": "error",
			"data": "Pod not found",
		})
		return
	}

	// If no container specified and pod has multiple containers, use the first one
	if container == "" {
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		} else {
			ws.WriteJSON(map[string]string{
				"type": "error",
				"data": "No containers found in pod",
			})
			return
		}
	}

	// Prepare log options
	podLogOptions := &corev1.PodLogOptions{
		Container:  container,
		Follow:     follow,
		Timestamps: timestamps,
	}

	if tailLines > 0 {
		podLogOptions.TailLines = &tailLines
	}

	// Get log stream from Kubernetes
	req := k8s.Clientset.CoreV1().Pods(namespace).GetLogs(podName, podLogOptions)
	stream, err := req.Stream(context.TODO())
	if err != nil {
		ws.WriteJSON(map[string]string{
			"type": "error",
			"data": "Failed to get logs: " + err.Error(),
		})
		return
	}
	defer stream.Close()

	// Stream logs to WebSocket
	reader := bufio.NewReader(stream)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				ws.WriteJSON(map[string]string{
					"type": "close",
					"data": "Stream ended",
				})
				break
			}
			ws.WriteJSON(map[string]string{
				"type": "error",
				"data": "Error reading logs: " + err.Error(),
			})
			break
		}

		// Send log line to client
		err = ws.WriteJSON(map[string]string{
			"type": "log",
			"data": line,
		})
		if err != nil {
			// Client disconnected
			break
		}
	}
}

// TerminalMessage represents messages sent between client and server
type TerminalMessage struct {
	Type string `json:"type"` // stdin, resize, stdout, stderr, error
	Data string `json:"data,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
	Cols uint16 `json:"cols,omitempty"`
}

// HandleTerminal handles WebSocket connections for interactive terminal sessions
func HandleTerminal(c *gin.Context) {
	namespace := c.Param("namespace")
	podName := c.Param("name")
	container := c.Query("container")
	command := c.DefaultQuery("command", "/bin/sh")

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upgrade to WebSocket"})
		return
	}
	defer ws.Close()

	// Get pod to verify it exists and get container info
	pod, err := k8s.Clientset.CoreV1().Pods(namespace).Get(context.TODO(), podName, metav1.GetOptions{})
	if err != nil {
		ws.WriteJSON(TerminalMessage{
			Type: "error",
			Data: "Pod not found",
		})
		return
	}

	// If no container specified, use the first one
	if container == "" {
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		} else {
			ws.WriteJSON(TerminalMessage{
				Type: "error",
				Data: "No containers found in pod",
			})
			return
		}
	}

	// Create exec request
	req := k8s.Clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Container: container,
		Command:   []string{command},
		Stdin:     true,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}, metav1.ParameterCodec)

	// Create SPDY executor
	exec, err := k8s.NewSPDYExecutor(req.URL())
	if err != nil {
		ws.WriteJSON(TerminalMessage{
			Type: "error",
			Data: "Failed to create executor: " + err.Error(),
		})
		return
	}

	// Create terminal session
	session := &TerminalSession{
		ws:   ws,
		exec: exec,
	}

	// Start the session
	session.Start()
}

// TerminalSession manages a terminal session
type TerminalSession struct {
	ws   *websocket.Conn
	exec *k8s.SPDYExecutor
}

// Start begins the terminal session
func (t *TerminalSession) Start() {
	// Create pipes for stdin/stdout/stderr
	stdinReader, stdinWriter := io.Pipe()
	stdoutReader, stdoutWriter := io.Pipe()
	stderrReader, stderrWriter := io.Pipe()

	// Handle WebSocket messages (stdin and resize)
	go func() {
		defer stdinWriter.Close()
		for {
			var msg TerminalMessage
			err := t.ws.ReadJSON(&msg)
			if err != nil {
				return
			}

			switch msg.Type {
			case "stdin":
				stdinWriter.Write([]byte(msg.Data))
			case "resize":
				// Terminal resize is handled by the executor
				// We'll implement this in the k8s package
			}
		}
	}()

	// Handle stdout
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := stdoutReader.Read(buf)
			if err != nil {
				return
			}
			t.ws.WriteJSON(TerminalMessage{
				Type: "stdout",
				Data: string(buf[:n]),
			})
		}
	}()

	// Handle stderr
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := stderrReader.Read(buf)
			if err != nil {
				return
			}
			t.ws.WriteJSON(TerminalMessage{
				Type: "stderr",
				Data: string(buf[:n]),
			})
		}
	}()

	// Execute the command
	err := t.exec.Stream(stdinReader, stdoutWriter, stderrWriter)
	if err != nil {
		t.ws.WriteJSON(TerminalMessage{
			Type: "error",
			Data: "Execution failed: " + err.Error(),
		})
	}
}

