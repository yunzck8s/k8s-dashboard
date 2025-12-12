package alerts

import (
	"fmt"
	"time"

	"github.com/k8s-dashboard/backend/internal/alertmanager"
)

// Service 告警服务
type Service struct {
	repo            *Repository
	alertmanager    *alertmanager.Client
}

// NewService 创建告警服务
func NewService(repo *Repository, alertmanagerClient *alertmanager.Client) *Service {
	return &Service{
		repo:            repo,
		alertmanager:    alertmanagerClient,
	}
}

// ========== 确认告警 ==========

// AcknowledgeAlert 确认告警
func (s *Service) AcknowledgeAlert(fingerprint, user, comment string, expiresAt *time.Time) error {
	ack := &Acknowledgement{
		AlertFingerprint: fingerprint,
		AcknowledgedBy:   user,
		AcknowledgedAt:   time.Now(),
		Comment:          comment,
		ExpiresAt:        expiresAt,
	}

	return s.repo.AcknowledgeAlert(ack)
}

// UnacknowledgeAlert 取消确认告警
func (s *Service) UnacknowledgeAlert(fingerprint string) error {
	return s.repo.UnacknowledgeAlert(fingerprint)
}

// GetAcknowledgement 获取告警确认记录
func (s *Service) GetAcknowledgement(fingerprint string) (*Acknowledgement, error) {
	return s.repo.GetAcknowledgement(fingerprint)
}

// ========== 静默规则 ==========

// CreateSilence 创建静默规则
func (s *Service) CreateSilence(matchers []map[string]interface{}, startsAt, endsAt time.Time, createdBy, comment string) (*Silence, error) {
	// 转换 matchers 格式为 Alertmanager 格式
	amMatchers := make([]alertmanager.Matcher, 0, len(matchers))
	for _, m := range matchers {
		amMatchers = append(amMatchers, alertmanager.Matcher{
			Name:    m["name"].(string),
			Value:   m["value"].(string),
			IsRegex: m["isRegex"].(bool),
			IsEqual: m["isEqual"].(bool),
		})
	}

	// 在 Alertmanager 中创建静默
	amSilence := &alertmanager.Silence{
		Matchers:  amMatchers,
		StartsAt:  startsAt,
		EndsAt:    endsAt,
		CreatedBy: createdBy,
		Comment:   comment,
	}

	silenceID, err := s.alertmanager.CreateSilence(amSilence)
	if err != nil {
		return nil, fmt.Errorf("在 Alertmanager 创建静默失败: %w", err)
	}

	// 计算状态
	now := time.Now()
	state := "active"
	if startsAt.After(now) {
		state = "pending"
	} else if endsAt.Before(now) {
		state = "expired"
	}

	// 保存到数据库
	silence := &Silence{
		SilenceID: silenceID,
		Matchers:  matchers,
		StartsAt:  startsAt,
		EndsAt:    endsAt,
		CreatedBy: createdBy,
		Comment:   comment,
		State:     state,
	}

	if err := s.repo.CreateSilence(silence); err != nil {
		// 如果数据库保存失败，尝试删除 Alertmanager 中的静默
		_ = s.alertmanager.DeleteSilence(silenceID)
		return nil, fmt.Errorf("保存静默到数据库失败: %w", err)
	}

	return silence, nil
}

// ListSilences 列出静默规则
func (s *Service) ListSilences(state string) ([]*Silence, error) {
	// 从 Alertmanager 获取静默规则
	amSilences, err := s.alertmanager.GetSilences()
	if err != nil {
		return nil, fmt.Errorf("从 Alertmanager 获取静默规则失败: %w", err)
	}

	// 从数据库获取静默规则
	dbSilences, err := s.repo.ListSilences(state)
	if err != nil {
		return nil, fmt.Errorf("从数据库获取静默规则失败: %w", err)
	}

	// 合并两个来源的数据，以 Alertmanager 为准
	silenceMap := make(map[string]*Silence)
	for _, dbs := range dbSilences {
		silenceMap[dbs.SilenceID] = dbs
	}

	result := make([]*Silence, 0, len(amSilences))
	for _, ams := range amSilences {
		// 优先使用数据库中的记录（包含创建者等信息）
		if dbs, ok := silenceMap[ams.ID]; ok {
			// 更新状态（以 Alertmanager 为准）
			dbs.State = ams.Status.State
			if dbs.State != state && state != "" {
				continue
			}
			result = append(result, dbs)
		} else {
			// 如果数据库中没有，直接使用 Alertmanager 的数据
			matchers := make([]map[string]interface{}, 0, len(ams.Matchers))
			for _, m := range ams.Matchers {
				matchers = append(matchers, map[string]interface{}{
					"name":    m.Name,
					"value":   m.Value,
					"isRegex": m.IsRegex,
					"isEqual": m.IsEqual,
				})
			}

			silence := &Silence{
				SilenceID: ams.ID,
				Matchers:  matchers,
				StartsAt:  ams.StartsAt,
				EndsAt:    ams.EndsAt,
				CreatedBy: ams.CreatedBy,
				Comment:   ams.Comment,
				State:     ams.Status.State,
			}

			if silence.State != state && state != "" {
				continue
			}
			result = append(result, silence)
		}
	}

	return result, nil
}

// GetSilence 获取单个静默规则
func (s *Service) GetSilence(id int64) (*Silence, error) {
	return s.repo.GetSilence(id)
}

// DeleteSilence 删除静默规则
func (s *Service) DeleteSilence(id int64) error {
	// 从数据库获取静默规则
	silence, err := s.repo.GetSilence(id)
	if err != nil {
		return fmt.Errorf("获取静默规则失败: %w", err)
	}
	if silence == nil {
		return fmt.Errorf("静默规则不存在")
	}

	// 从 Alertmanager 删除
	if err := s.alertmanager.DeleteSilence(silence.SilenceID); err != nil {
		return fmt.Errorf("从 Alertmanager 删除静默失败: %w", err)
	}

	// 从数据库删除
	if err := s.repo.DeleteSilence(id); err != nil {
		return fmt.Errorf("从数据库删除静默失败: %w", err)
	}

	return nil
}

// UpdateSilenceState 更新静默规则状态（定时任务调用）
func (s *Service) UpdateSilenceState(id int64, state string) error {
	return s.repo.UpdateSilenceState(id, state)
}
