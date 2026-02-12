package k8s

import (
	"os"
	"path/filepath"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/metrics/pkg/client/clientset/versioned"
)

// Client 封装 Kubernetes 客户端
type Client struct {
	// 标准客户端
	Clientset *kubernetes.Clientset
	// 动态客户端（用于处理任意资源）
	DynamicClient dynamic.Interface
	// Metrics 客户端
	MetricsClient *versioned.Clientset
	// REST 配置
	Config *rest.Config
}

// NewClient 创建新的 Kubernetes 客户端
func NewClient() (*Client, error) {
	config, err := getConfig()
	if err != nil {
		return nil, err
	}

	return NewClientWithConfig(config)
}

// NewClientWithConfig 使用指定的 REST 配置创建客户端。
func NewClientWithConfig(config *rest.Config) (*Client, error) {
	// 创建标准客户端
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	// 创建动态客户端
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	// 创建 Metrics 客户端
	metricsClient, err := versioned.NewForConfig(config)
	if err != nil {
		// Metrics 客户端创建失败不是致命错误
		metricsClient = nil
	}

	return &Client{
		Clientset:     clientset,
		DynamicClient: dynamicClient,
		MetricsClient: metricsClient,
		Config:        config,
	}, nil
}

// getConfig 获取 Kubernetes 配置
// 优先使用 kubeconfig，集群内部署时回退到 InCluster 模式
func getConfig() (*rest.Config, error) {
	// 首先尝试 kubeconfig
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			kubeconfig = filepath.Join(home, ".kube", "config")
		}
	}

	// 检查 kubeconfig 文件是否存在
	if kubeconfig != "" {
		if _, err := os.Stat(kubeconfig); err == nil {
			config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
			if err == nil {
				return config, nil
			}
		}
	}

	// kubeconfig 不可用时，尝试集群内配置（InCluster 模式）
	return rest.InClusterConfig()
}

// NewClientWithKubeconfig 使用指定的 kubeconfig 创建客户端
func NewClientWithKubeconfig(kubeconfig string) (*Client, error) {
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, err
	}
	return NewClientWithConfig(config)
}

// NewClientWithKubeconfigBytes 使用 kubeconfig 内容创建客户端。
func NewClientWithKubeconfigBytes(kubeconfig []byte) (*Client, error) {
	if len(kubeconfig) == 0 {
		return nil, os.ErrInvalid
	}
	config, err := clientcmd.RESTConfigFromKubeConfig(kubeconfig)
	if err != nil {
		return nil, err
	}
	// 兼容某些 kubeconfig 缺失 CurrentContext 的情况。
	if config.Host == "" {
		cfg, err := clientcmd.Load(kubeconfig)
		if err != nil {
			return nil, err
		}
		if cfg.CurrentContext == "" && len(cfg.Contexts) > 0 {
			for name := range cfg.Contexts {
				cfg.CurrentContext = name
				break
			}
		}
		restCfg, err := clientcmd.NewDefaultClientConfig(*cfg, &clientcmd.ConfigOverrides{}).ClientConfig()
		if err != nil {
			return nil, err
		}
		config = restCfg
	}
	return NewClientWithConfig(config)
}
