package k8s

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/client-go/util/homedir"
	"k8s.io/metrics/pkg/client/clientset/versioned"
)

var (
	Clientset     *kubernetes.Clientset
	MetricsClient *versioned.Clientset
	RestConfig    *rest.Config
)

// InitK8sClient initializes the Kubernetes client
func InitK8sClient() error {
	var config *rest.Config
	var err error

	kubeconfig := filepath.Join(homedir.HomeDir(), ".kube", "config")

	if _, err := os.Stat(kubeconfig); err == nil {
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return err
		}
	} else {
		config, err = rest.InClusterConfig()
		if err != nil {
			return err
		}
	}

	RestConfig = config

	Clientset, err = kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create clientset: %v", err)
	}

	MetricsClient, err = versioned.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create metrics client: %v", err)
	}

	// Verify connection
	_, err = Clientset.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to connect to cluster: %v", err)
	}

	fmt.Println("Successfully connected to Kubernetes cluster")
	return nil
}

// SPDYExecutor wraps the remotecommand.Executor for terminal sessions
type SPDYExecutor struct {
	executor remotecommand.Executor
}

// NewSPDYExecutor creates a new SPDY executor for the given URL
func NewSPDYExecutor(url *url.URL) (*SPDYExecutor, error) {
	exec, err := remotecommand.NewSPDYExecutor(RestConfig, "POST", url)
	if err != nil {
		return nil, err
	}

	return &SPDYExecutor{
		executor: exec,
	}, nil
}

// Stream executes the command and streams stdin/stdout/stderr
func (e *SPDYExecutor) Stream(stdin io.Reader, stdout, stderr io.Writer) error {
	return e.executor.Stream(remotecommand.StreamOptions{
		Stdin:  stdin,
		Stdout: stdout,
		Stderr: stderr,
		Tty:    true,
	})
}
