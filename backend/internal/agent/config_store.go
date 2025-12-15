package agent

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"github.com/k8s-dashboard/backend/internal/agent/provider"
)

// ConfigStore Agent 配置存储
type ConfigStore struct {
	db *sql.DB
	mu sync.RWMutex
}

// NewConfigStore 创建配置存储
func NewConfigStore(db *sql.DB) (*ConfigStore, error) {
	store := &ConfigStore{
		db: db,
	}

	// 初始化数据库表
	if err := store.initTables(); err != nil {
		return nil, err
	}

	return store, nil
}

// initTables 初始化数据库表
func (s *ConfigStore) initTables() error {
	// 创建 agent_config 表
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS agent_config (
		id SERIAL PRIMARY KEY,
		provider_name VARCHAR(50) UNIQUE NOT NULL,
		api_key TEXT NOT NULL,
		enabled BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`

	if _, err := s.db.Exec(createTableSQL); err != nil {
		return fmt.Errorf("failed to create agent_config table: %w", err)
	}

	log.Println("Agent 配置数据库初始化成功")
	return nil
}

// SaveProviderConfig 保存 Provider 配置
func (s *ConfigStore) SaveProviderConfig(providerName string, config provider.ProviderConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `
		INSERT INTO agent_config (provider_name, api_key, enabled, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (provider_name)
		DO UPDATE SET
			api_key = EXCLUDED.api_key,
			enabled = EXCLUDED.enabled,
			updated_at = NOW()
	`

	_, err := s.db.Exec(query, providerName, config.APIKey, config.Enabled)
	if err != nil {
		return fmt.Errorf("failed to save provider config: %w", err)
	}

	log.Printf("已保存 Provider 配置: %s", providerName)
	return nil
}

// LoadProviderConfig 加载单个 Provider 配置
func (s *ConfigStore) LoadProviderConfig(providerName string) (*provider.ProviderConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT api_key, enabled FROM agent_config WHERE provider_name = $1`

	var config provider.ProviderConfig
	err := s.db.QueryRow(query, providerName).Scan(&config.APIKey, &config.Enabled)
	if err == sql.ErrNoRows {
		return nil, nil // 未配置
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load provider config: %w", err)
	}

	return &config, nil
}

// LoadAllProviderConfigs 加载所有 Provider 配置
func (s *ConfigStore) LoadAllProviderConfigs() (map[string]provider.ProviderConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT provider_name, api_key, enabled FROM agent_config`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query provider configs: %w", err)
	}
	defer rows.Close()

	configs := make(map[string]provider.ProviderConfig)
	for rows.Next() {
		var providerName string
		var config provider.ProviderConfig
		if err := rows.Scan(&providerName, &config.APIKey, &config.Enabled); err != nil {
			log.Printf("Error scanning provider config: %v", err)
			continue
		}
		configs[providerName] = config
	}

	return configs, nil
}

// DeleteProviderConfig 删除 Provider 配置
func (s *ConfigStore) DeleteProviderConfig(providerName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := `DELETE FROM agent_config WHERE provider_name = $1`

	_, err := s.db.Exec(query, providerName)
	if err != nil {
		return fmt.Errorf("failed to delete provider config: %w", err)
	}

	log.Printf("已删除 Provider 配置: %s", providerName)
	return nil
}

// SaveAgentConfig 保存完整的 Agent 配置
func (s *ConfigStore) SaveAgentConfig(config *AgentConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 将配置序列化为 JSON
	configJSON, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	query := `
		INSERT INTO agent_config (provider_name, api_key, enabled, updated_at)
		VALUES ('__system__', $1, true, NOW())
		ON CONFLICT (provider_name)
		DO UPDATE SET
			api_key = EXCLUDED.api_key,
			updated_at = NOW()
	`

	_, err = s.db.Exec(query, string(configJSON))
	if err != nil {
		return fmt.Errorf("failed to save agent config: %w", err)
	}

	log.Println("已保存完整 Agent 配置")
	return nil
}

// LoadAgentConfig 加载完整的 Agent 配置
func (s *ConfigStore) LoadAgentConfig() (*AgentConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query := `SELECT api_key FROM agent_config WHERE provider_name = '__system__'`

	var configJSON string
	err := s.db.QueryRow(query).Scan(&configJSON)
	if err == sql.ErrNoRows {
		return nil, nil // 未配置
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load agent config: %w", err)
	}

	var config AgentConfig
	if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}
