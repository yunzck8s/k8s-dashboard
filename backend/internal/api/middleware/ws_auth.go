package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/k8s-dashboard/backend/internal/auth"
)

const (
	ContextWSTicketKey = "wsTicket"
	defaultWSAction    = "exec"
	wsTicketTTL        = 30 * time.Second
)

var (
	errTicketMissing = errors.New("ticket is required")
	errTicketInvalid = errors.New("ticket invalid or consumed")
	errTicketExpired = errors.New("ticket expired")
	errOriginDenied  = errors.New("origin not allowed")
)

type WSTicket struct {
	Value      string
	UserID     int64
	Username   string
	Action     string
	Namespace  string
	Name       string
	Container  string
	Cluster    string
	ExpiresAt  time.Time
	ConsumedAt *time.Time
}

type WSTicketRequest struct {
	Action    string `json:"action"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Container string `json:"container"`
	Cluster   string `json:"cluster"`
}

var wsTicketStore = struct {
	mu      sync.Mutex
	tickets map[string]*WSTicket
}{
	tickets: map[string]*WSTicket{},
}

// IssueWSTicket 为当前用户签发一次性 WS 票据。
func IssueWSTicket(user *auth.User, req WSTicketRequest) (*WSTicket, error) {
	if user == nil {
		return nil, errors.New("unauthenticated")
	}

	if req.Action == "" {
		req.Action = defaultWSAction
	}

	value, err := randomToken(32)
	if err != nil {
		return nil, err
	}

	ticket := &WSTicket{
		Value:     value,
		UserID:    user.ID,
		Username:  user.Username,
		Action:    req.Action,
		Namespace: req.Namespace,
		Name:      req.Name,
		Container: req.Container,
		Cluster:   req.Cluster,
		ExpiresAt: time.Now().Add(wsTicketTTL),
	}

	wsTicketStore.mu.Lock()
	defer wsTicketStore.mu.Unlock()

	cleanupExpiredTicketsLocked(time.Now())
	wsTicketStore.tickets[value] = ticket

	return ticket, nil
}

func ConsumeWSTicket(value string) (*WSTicket, error) {
	if strings.TrimSpace(value) == "" {
		return nil, errTicketMissing
	}

	now := time.Now()

	wsTicketStore.mu.Lock()
	defer wsTicketStore.mu.Unlock()

	ticket, ok := wsTicketStore.tickets[value]
	if !ok {
		return nil, errTicketInvalid
	}

	if now.After(ticket.ExpiresAt) {
		delete(wsTicketStore.tickets, value)
		return nil, errTicketExpired
	}

	if ticket.ConsumedAt != nil {
		return nil, errTicketInvalid
	}

	consumedAt := now
	ticket.ConsumedAt = &consumedAt

	return ticket, nil
}

// WSAuthMiddleware 统一校验 WS 票据、Origin，并把票据上下文注入请求。
// 兼容开关：WS_ALLOW_QUERY_TOKEN=true 时允许 token=JWT 的旧链路（仅应急）。
func WSAuthMiddleware(authClient *auth.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := validateOrigin(c); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			c.Abort()
			return
		}

		ticketValue := c.Query("ticket")
		if ticketValue == "" && allowQueryTokenCompat() {
			token := c.Query("token")
			if token != "" && authClient != nil {
				user, err := authClient.ValidateToken(token)
				if err == nil {
					c.Set(ContextUserKey, user)
					c.Next()
					return
				}
			}
		}

		ticket, err := ConsumeWSTicket(ticketValue)
		if err != nil {
			status := http.StatusUnauthorized
			if errors.Is(err, errOriginDenied) {
				status = http.StatusForbidden
			}
			c.JSON(status, gin.H{"error": err.Error()})
			c.Abort()
			return
		}

		if !ticketMatchesCluster(c, ticket) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "ticket cluster mismatch"})
			c.Abort()
			return
		}

		expectedAction := actionFromWSPath(c.Request.URL.Path)
		if ticket.Action != "" && ticket.Action != expectedAction {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "ticket action mismatch"})
			c.Abort()
			return
		}

		c.Set(ContextWSTicketKey, ticket)
		c.Next()
	}
}

func GetWSTicket(c *gin.Context) *WSTicket {
	value, ok := c.Get(ContextWSTicketKey)
	if !ok {
		return nil
	}
	ticket, _ := value.(*WSTicket)
	return ticket
}

func actionFromWSPath(path string) string {
	switch {
	case strings.HasSuffix(path, "/exec"):
		return "exec"
	case strings.HasSuffix(path, "/logs"):
		return "logs"
	case strings.HasSuffix(path, "/watch"):
		return "watch"
	default:
		return defaultWSAction
	}
}

func ticketMatchesCluster(c *gin.Context, ticket *WSTicket) bool {
	if ticket == nil {
		return false
	}
	if ticket.Cluster == "" {
		return true
	}

	cluster := GetClusterName(c)
	if cluster == "" {
		cluster = strings.TrimSpace(c.Query("cluster"))
	}
	if cluster == "" {
		cluster = "default"
	}
	return ticket.Cluster == cluster
}

func validateOrigin(c *gin.Context) error {
	origin := strings.TrimSpace(c.GetHeader("Origin"))
	if origin == "" {
		return errOriginDenied
	}

	allowedEnv := strings.TrimSpace(os.Getenv("WS_ALLOWED_ORIGINS"))
	if allowedEnv == "" {
		u, err := url.Parse(origin)
		if err != nil {
			return errOriginDenied
		}
		return sameHost(c.Request.Host, u.Host)
	}

	for _, item := range strings.Split(allowedEnv, ",") {
		allowed := strings.TrimSpace(item)
		if allowed == "" {
			continue
		}
		if strings.EqualFold(allowed, origin) {
			return nil
		}
	}

	return errOriginDenied
}

func sameHost(requestHost, originHost string) error {
	if strings.EqualFold(stripDefaultPort(requestHost), stripDefaultPort(originHost)) {
		return nil
	}
	return errOriginDenied
}

func stripDefaultPort(host string) string {
	host = strings.TrimSpace(host)
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimPrefix(host, "http://")
	host = strings.TrimSuffix(host, ":80")
	host = strings.TrimSuffix(host, ":443")
	return host
}

func allowQueryTokenCompat() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("WS_ALLOW_QUERY_TOKEN")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func cleanupExpiredTicketsLocked(now time.Time) {
	for key, ticket := range wsTicketStore.tickets {
		if ticket == nil || now.After(ticket.ExpiresAt.Add(5*time.Minute)) {
			delete(wsTicketStore.tickets, key)
		}
	}
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
