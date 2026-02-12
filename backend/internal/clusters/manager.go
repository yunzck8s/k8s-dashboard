package clusters

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	dbutil "github.com/k8s-dashboard/backend/internal/db"
	"github.com/k8s-dashboard/backend/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Info 是提供给 API/前端的集群视图。
type Info struct {
	Name        string `json:"name"`
	Endpoint    string `json:"endpoint"`
	Version     string `json:"version"`
	Status      string `json:"status"` // connected | disconnected | error
	LastChecked string `json:"lastChecked"`
	NodeCount   int    `json:"nodeCount"`
	PodCount    int    `json:"podCount"`
	IsDefault   bool   `json:"isDefault"`
	Enabled     bool   `json:"enabled"`
	LastError   string `json:"lastError,omitempty"`
	Source      string `json:"source"` // kubeconfig | incluster
}

// Manager 负责多集群管理、客户端缓存和连通性检查。
type Manager struct {
	repo          *Repository
	crypto        *Crypto
	defaultClient *k8s.Client

	mu    sync.RWMutex
	cache map[string]*k8s.Client
}

func NewManager(db *sql.DB, dialect dbutil.Dialect, jwtSecret string, defaultClient *k8s.Client) (*Manager, error) {
	repo, err := NewRepository(db, dialect)
	if err != nil {
		return nil, fmt.Errorf("init cluster repository failed: %w", err)
	}
	crypto, err := NewCryptoFromEnv(jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("init cluster crypto failed: %w", err)
	}

	m := &Manager{
		repo:          repo,
		crypto:        crypto,
		defaultClient: defaultClient,
		cache:         make(map[string]*k8s.Client),
	}

	if err := m.bootstrapDefaultCluster(); err != nil {
		return nil, fmt.Errorf("bootstrap default cluster failed: %w", err)
	}
	return m, nil
}

func (m *Manager) bootstrapDefaultCluster() error {
	count, err := m.repo.Count()
	if err != nil {
		return err
	}
	if count == 0 {
		record, err := m.buildDefaultRecord()
		if err != nil {
			return err
		}
		if err := m.repo.Create(record); err != nil {
			return err
		}
		return nil
	}

	def, err := m.repo.GetDefault()
	if err != nil {
		return err
	}
	if def != nil {
		return nil
	}

	records, err := m.repo.List()
	if err != nil {
		return err
	}
	if len(records) == 0 {
		record, err := m.buildDefaultRecord()
		if err != nil {
			return err
		}
		return m.repo.Create(record)
	}

	target := records[0].Name
	for _, rec := range records {
		if rec.Name == DefaultClusterName {
			target = rec.Name
			break
		}
	}
	return m.repo.EnsureDefault(target)
}

func (m *Manager) buildDefaultRecord() (Record, error) {
	record := Record{
		Name:      DefaultClusterName,
		Source:    ClusterSourceInCluster,
		IsDefault: true,
		Enabled:   true,
	}

	path := resolveKubeconfigPath()
	if path == "" {
		return record, nil
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return record, nil
	}
	encrypted, err := m.crypto.Encrypt(content)
	if err != nil {
		return Record{}, err
	}

	record.Source = ClusterSourceKubeconfig
	record.KubeconfigEncrypted = encrypted
	return record, nil
}

func resolveKubeconfigPath() string {
	raw := strings.TrimSpace(os.Getenv("KUBECONFIG"))
	if raw != "" {
		parts := filepath.SplitList(raw)
		for _, p := range parts {
			if p == "" {
				continue
			}
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	path := filepath.Join(home, ".kube", "config")
	if _, err := os.Stat(path); err == nil {
		return path
	}
	return ""
}

// ResolveClusterName 解析请求目标集群名，空值回落默认集群。
func (m *Manager) ResolveClusterName(requested string) (string, error) {
	name := strings.TrimSpace(requested)
	if name == "" {
		def, err := m.repo.GetDefault()
		if err != nil {
			return "", err
		}
		if def == nil {
			return "", errors.New("default cluster not found")
		}
		return def.Name, nil
	}

	if _, err := m.repo.Get(name); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("cluster %q not found", name)
		}
		return "", err
	}
	return name, nil
}

// GetClientForRequest 根据请求集群名返回集群客户端。
func (m *Manager) GetClientForRequest(requested string) (*k8s.Client, string, error) {
	name, err := m.ResolveClusterName(requested)
	if err != nil {
		return nil, "", err
	}
	client, err := m.GetClient(name)
	if err != nil {
		return nil, name, err
	}
	return client, name, nil
}

// GetClient 获取指定集群客户端（带缓存）。
func (m *Manager) GetClient(name string) (*k8s.Client, error) {
	rec, err := m.repo.Get(name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("cluster %q not found", name)
		}
		return nil, err
	}
	if !rec.Enabled {
		return nil, fmt.Errorf("cluster %q is disabled", name)
	}

	m.mu.RLock()
	cached := m.cache[name]
	m.mu.RUnlock()
	if cached != nil {
		return cached, nil
	}

	client, err := m.createClient(*rec)
	checkedAt := time.Now()
	if err != nil {
		_ = m.repo.UpdateHealth(name, checkedAt, err.Error())
		return nil, err
	}
	_ = m.repo.UpdateHealth(name, checkedAt, "")

	m.mu.Lock()
	m.cache[name] = client
	m.mu.Unlock()
	return client, nil
}

func (m *Manager) createClient(rec Record) (*k8s.Client, error) {
	switch rec.Source {
	case ClusterSourceInCluster:
		if m.defaultClient == nil {
			return nil, errors.New("default kubernetes client is nil")
		}
		return m.defaultClient, nil
	case ClusterSourceKubeconfig:
		plain, err := m.crypto.Decrypt(rec.KubeconfigEncrypted)
		if err != nil {
			return nil, fmt.Errorf("decrypt kubeconfig failed: %w", err)
		}
		if len(plain) == 0 {
			return nil, errors.New("empty kubeconfig")
		}
		client, err := k8s.NewClientWithKubeconfigBytes(plain)
		if err != nil {
			return nil, fmt.Errorf("init kubernetes client failed: %w", err)
		}
		return client, nil
	default:
		return nil, fmt.Errorf("unknown cluster source: %s", rec.Source)
	}
}

func (m *Manager) probeCluster(ctx context.Context, name string) (endpoint, version string, nodeCount, podCount int, err error) {
	client, err := m.GetClient(name)
	if err != nil {
		return "", "", 0, 0, err
	}

	if client.Config != nil {
		endpoint = client.Config.Host
	}

	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	serverVersion, err := client.Clientset.Discovery().ServerVersion()
	if err != nil {
		return endpoint, "", 0, 0, err
	}
	version = serverVersion.GitVersion

	nodes, err := client.Clientset.CoreV1().Nodes().List(probeCtx, metav1.ListOptions{})
	if err == nil {
		nodeCount = len(nodes.Items)
	}
	pods, err := client.Clientset.CoreV1().Pods("").List(probeCtx, metav1.ListOptions{})
	if err == nil {
		podCount = len(pods.Items)
	}
	return endpoint, version, nodeCount, podCount, nil
}

func infoFromRecord(rec Record) Info {
	lastChecked := ""
	if rec.LastCheckedAt != nil {
		lastChecked = rec.LastCheckedAt.UTC().Format(time.RFC3339)
	}
	return Info{
		Name:        rec.Name,
		Status:      "disconnected",
		LastChecked: lastChecked,
		NodeCount:   0,
		PodCount:    0,
		IsDefault:   rec.IsDefault,
		Enabled:     rec.Enabled,
		LastError:   rec.LastError,
		Source:      rec.Source,
	}
}

// List 返回所有集群状态。
func (m *Manager) List(ctx context.Context) ([]Info, error) {
	records, err := m.repo.List()
	if err != nil {
		return nil, err
	}

	items := make([]Info, 0, len(records))
	for _, rec := range records {
		item := infoFromRecord(rec)
		endpoint, version, nodeCount, podCount, probeErr := m.probeCluster(ctx, rec.Name)
		if probeErr != nil {
			item.Status = "error"
			item.LastError = probeErr.Error()
			_ = m.repo.UpdateHealth(rec.Name, time.Now(), probeErr.Error())
		} else {
			item.Status = "connected"
			item.Endpoint = endpoint
			item.Version = version
			item.NodeCount = nodeCount
			item.PodCount = podCount
			item.LastError = ""
			_ = m.repo.UpdateHealth(rec.Name, time.Now(), "")
		}
		items = append(items, item)
	}
	return items, nil
}

// Get 返回单个集群状态。
func (m *Manager) Get(ctx context.Context, name string) (*Info, error) {
	rec, err := m.repo.Get(name)
	if err != nil {
		return nil, err
	}
	item := infoFromRecord(*rec)
	endpoint, version, nodeCount, podCount, probeErr := m.probeCluster(ctx, rec.Name)
	if probeErr != nil {
		item.Status = "error"
		item.LastError = probeErr.Error()
		_ = m.repo.UpdateHealth(rec.Name, time.Now(), probeErr.Error())
		return &item, nil
	}
	item.Status = "connected"
	item.Endpoint = endpoint
	item.Version = version
	item.NodeCount = nodeCount
	item.PodCount = podCount
	item.LastError = ""
	_ = m.repo.UpdateHealth(rec.Name, time.Now(), "")
	return &item, nil
}

// TestKubeconfig 测试 kubeconfig 连通性，不会持久化。
func (m *Manager) TestKubeconfig(ctx context.Context, kubeconfig string) (*Info, error) {
	content := strings.TrimSpace(kubeconfig)
	if content == "" {
		return nil, errors.New("kubeconfig is required")
	}

	client, err := k8s.NewClientWithKubeconfigBytes([]byte(content))
	if err != nil {
		return nil, err
	}

	endpoint := ""
	if client.Config != nil {
		endpoint = client.Config.Host
	}
	version := ""
	nodeCount := 0
	podCount := 0

	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	v, err := client.Clientset.Discovery().ServerVersion()
	if err != nil {
		return nil, err
	}
	version = v.GitVersion

	if nodes, err := client.Clientset.CoreV1().Nodes().List(probeCtx, metav1.ListOptions{}); err == nil {
		nodeCount = len(nodes.Items)
	}
	if pods, err := client.Clientset.CoreV1().Pods("").List(probeCtx, metav1.ListOptions{}); err == nil {
		podCount = len(pods.Items)
	}

	return &Info{
		Name:        "test",
		Endpoint:    endpoint,
		Version:     version,
		Status:      "connected",
		LastChecked: time.Now().UTC().Format(time.RFC3339),
		NodeCount:   nodeCount,
		PodCount:    podCount,
		IsDefault:   false,
		Enabled:     true,
		Source:      ClusterSourceKubeconfig,
	}, nil
}

// Add 新增集群。
func (m *Manager) Add(ctx context.Context, name, kubeconfig string) (*Info, error) {
	clusterName := strings.TrimSpace(name)
	if clusterName == "" {
		return nil, errors.New("cluster name is required")
	}
	if strings.EqualFold(clusterName, DefaultClusterName) {
		return nil, fmt.Errorf("%q is reserved", DefaultClusterName)
	}

	content := strings.TrimSpace(kubeconfig)
	if content == "" {
		return nil, errors.New("kubeconfig is required")
	}

	if _, err := m.repo.Get(clusterName); err == nil {
		return nil, fmt.Errorf("cluster %q already exists", clusterName)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	client, err := k8s.NewClientWithKubeconfigBytes([]byte(content))
	if err != nil {
		return nil, err
	}

	encrypted, err := m.crypto.Encrypt([]byte(content))
	if err != nil {
		return nil, err
	}

	if err := m.repo.Create(Record{
		Name:                clusterName,
		KubeconfigEncrypted: encrypted,
		Source:              ClusterSourceKubeconfig,
		IsDefault:           false,
		Enabled:             true,
	}); err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.cache[clusterName] = client
	m.mu.Unlock()

	return m.Get(ctx, clusterName)
}

// Delete 删除集群（默认集群不可删）。
func (m *Manager) Delete(name string) error {
	clusterName := strings.TrimSpace(name)
	if clusterName == "" {
		return errors.New("cluster name is required")
	}
	if err := m.repo.ValidateDelete(clusterName); err != nil {
		return err
	}
	if err := m.repo.Delete(clusterName); err != nil {
		return err
	}
	m.mu.Lock()
	delete(m.cache, clusterName)
	m.mu.Unlock()
	return nil
}

// Switch 验证目标集群可用并返回信息。
func (m *Manager) Switch(ctx context.Context, name string) (*Info, error) {
	clusterName := strings.TrimSpace(name)
	if clusterName == "" {
		return nil, errors.New("cluster name is required")
	}
	_, err := m.GetClient(clusterName)
	if err != nil {
		return nil, err
	}
	return m.Get(ctx, clusterName)
}
