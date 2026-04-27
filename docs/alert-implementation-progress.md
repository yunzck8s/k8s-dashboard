# K8s Dashboard 告警管理系统 - 实现进度记录

> 文档版本: v1.0
> 最后更新: 2025-12-11
> 实施状态: Step 1-2 已完成，Step 3-5 待实现

---

## 📋 实施概览

### 已完成功能（Step 1-2）

#### ✅ Step 1: 活跃告警展示
- **告警列表展示**：支持查看所有活跃告警，按严重程度分类
- **多维度过滤**：支持按严重级别（critical/warning/info）、命名空间、告警名称过滤
- **告警详情抽屉**：点击告警卡片查看完整详情（标签、注解、时间、状态）
- **自动刷新**：每 30 秒自动刷新告警列表
- **告警摘要徽章**：顶部显示各级别告警数量统计

#### ✅ Step 2: 确认与静默管理
- **告警确认（Acknowledgement）**：
  - 支持确认已知告警，添加处理备注
  - 显示确认状态（确认人、时间、备注）
  - 支持取消确认
  - 确认信息持久化到 PostgreSQL

- **静默规则管理（Silence）**：
  - 创建静默规则（支持多条件匹配器）
  - 匹配器支持正则表达式和不等式操作
  - 灵活的持续时间选择（30分钟 - 7天）
  - 静默规则列表展示（状态：活跃/待生效/已过期）
  - 删除静默规则（带二次确认）
  - 自动同步到 Alertmanager

---

## 🔧 技术架构

### 后端架构（Go + Gin）

采用三层架构模式：

```
Repository（数据访问层）
    ↓
Service（业务逻辑层）
    ↓
Handler（HTTP 处理层）
```

#### 核心模块

**1. Alertmanager 客户端** (`backend/internal/alertmanager/client.go`)
- 封装 Alertmanager API v2 调用
- 支持告警列表过滤、详情查询
- 支持静默规则 CRUD 操作

**2. 告警数据仓库** (`backend/internal/alerts/repository.go`)
- PostgreSQL 数据库操作
- 自动创建表结构
- 管理确认记录和静默规则元数据

**3. 告警服务** (`backend/internal/alerts/service.go`)
- 整合数据仓库和 Alertmanager 客户端
- 实现业务逻辑和数据同步
- 处理静默规则的双向同步

### 前端架构（React + TypeScript）

**技术栈**：
- React 18 + TypeScript
- TanStack Query（数据获取与缓存）
- Tailwind CSS + Heroicons（UI 样式）
- React Router（路由管理）
- date-fns（时间格式化）

**组件结构**：
```
Alerts.tsx (主容器，Tab 导航)
  ├── AlertsActive.tsx (活跃告警)
  │   ├── AlertCard (告警卡片)
  │   ├── AlertDetailDrawer (详情抽屉)
  │   └── AcknowledgeModal (确认弹窗)
  ├── AlertsSilences.tsx (静默规则)
  │   ├── SilenceCard (静默卡片)
  │   └── CreateSilenceModal (创建弹窗)
  ├── AlertsHistory.tsx (历史记录 - 待开发)
  └── AlertsRules.tsx (告警规则 - 待开发)
```

---

## 💾 数据库设计

### 表结构

#### 1. alert_acknowledgements（告警确认表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| alert_fingerprint | VARCHAR(64) | 告警指纹（唯一标识） |
| acknowledged_by | VARCHAR(255) | 确认人 |
| acknowledged_at | TIMESTAMP | 确认时间 |
| comment | TEXT | 确认备注 |
| expires_at | TIMESTAMP | 过期时间（可选） |

**索引**：
```sql
CREATE UNIQUE INDEX idx_alert_ack_fingerprint ON alert_acknowledgements(alert_fingerprint);
```

#### 2. alert_silences（静默规则表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| silence_id | VARCHAR(64) | Alertmanager 静默 ID（唯一） |
| matchers | JSONB | 匹配器列表 |
| starts_at | TIMESTAMP | 生效开始时间 |
| ends_at | TIMESTAMP | 生效结束时间 |
| created_by | VARCHAR(255) | 创建人 |
| comment | TEXT | 静默原因备注 |
| state | VARCHAR(20) | 状态（active/pending/expired） |
| created_at | TIMESTAMP | 创建时间 |

**Matchers JSONB 结构**：
```json
[
  {
    "name": "alertname",
    "value": "HighCPUUsage",
    "isRegex": false,
    "isEqual": true
  }
]
```

---

## 🌐 API 接口文档

### 告警接口

#### 1. 获取告警列表
```http
GET /api/v1/alerts?severity={critical|warning|info}&namespace={ns}&alertname={name}&state=active
```

**响应示例**：
```json
{
  "items": [
    {
      "labels": {
        "alertname": "HighCPUUsage",
        "severity": "critical",
        "namespace": "default"
      },
      "annotations": {
        "summary": "CPU usage is above 80%",
        "description": "Node has high CPU usage"
      },
      "startsAt": "2025-12-11T10:00:00Z",
      "fingerprint": "abc123...",
      "status": {
        "state": "active",
        "silencedBy": []
      }
    }
  ],
  "total": 1
}
```

#### 2. 获取告警摘要
```http
GET /api/v1/alerts/summary
```

**响应示例**：
```json
{
  "total": 15,
  "critical": 3,
  "warning": 8,
  "info": 4
}
```

#### 3. 获取告警详情
```http
GET /api/v1/alerts/{fingerprint}
```

#### 4. 获取告警名称列表
```http
GET /api/v1/alerts/names
```

**响应示例**：
```json
{
  "items": ["HighCPUUsage", "PodCrashLooping", "NodeNotReady"]
}
```

### 确认接口

#### 5. 确认告警
```http
POST /api/v1/alerts/{fingerprint}/acknowledge
Content-Type: application/json

{
  "comment": "已排查，正在处理",
  "expiresAt": "2025-12-12T10:00:00Z"  // 可选
}
```

#### 6. 取消确认
```http
DELETE /api/v1/alerts/{fingerprint}/acknowledge
```

#### 7. 获取确认信息
```http
GET /api/v1/alerts/{fingerprint}/acknowledgement
```

**响应示例**：
```json
{
  "id": 1,
  "alertFingerprint": "abc123...",
  "acknowledgedBy": "admin",
  "acknowledgedAt": "2025-12-11T10:30:00Z",
  "comment": "已排查，正在处理"
}
```

### 静默接口

#### 8. 获取静默规则列表
```http
GET /api/v1/silences?state={active|pending|expired}
```

**响应示例**：
```json
{
  "items": [
    {
      "id": 1,
      "silenceId": "xyz789...",
      "matchers": [
        {
          "name": "alertname",
          "value": "HighCPUUsage",
          "isRegex": false,
          "isEqual": true
        }
      ],
      "startsAt": "2025-12-11T10:00:00Z",
      "endsAt": "2025-12-11T12:00:00Z",
      "createdBy": "admin",
      "comment": "维护期间临时静默",
      "state": "active",
      "createdAt": "2025-12-11T10:00:00Z"
    }
  ],
  "total": 1
}
```

#### 9. 创建静默规则
```http
POST /api/v1/silences
Content-Type: application/json

{
  "matchers": [
    {
      "name": "namespace",
      "value": "default",
      "isRegex": false,
      "isEqual": true
    }
  ],
  "startsAt": "2025-12-11T10:00:00Z",
  "endsAt": "2025-12-11T12:00:00Z",
  "comment": "维护期间临时静默"
}
```

**说明**：
- 创建人（createdBy）从请求头 `X-User-Name` 获取，默认为 "admin"
- 成功创建后自动同步到 Alertmanager

#### 10. 删除静默规则
```http
DELETE /api/v1/silences/{id}
```

**说明**：
- 同时删除数据库记录和 Alertmanager 中的静默规则

---

## 📱 前端功能使用指南

### 1. 查看活跃告警

**路径**：`/alerts?tab=active`

**功能**：
- 告警卡片展示，按严重程度分色：
  - 🔴 严重（Critical）：红色边框
  - 🟡 警告（Warning）：黄色边框
  - 🔵 信息（Info）：蓝色边框
- 顶部过滤栏：
  - 严重级别下拉选择
  - 命名空间下拉选择
  - 告警名称下拉选择
  - 清除按钮一键重置过滤
- 自动刷新：每 30 秒刷新一次
- 手动刷新：点击刷新按钮

### 2. 查看告警详情

**操作**：点击任意告警卡片

**详情内容**：
- 摘要（Summary）
- 描述（Description）
- 开始时间和持续时间
- 所有标签（Labels）
- 所有注解（Annotations）
- 告警状态和静默信息
- 来源链接（Generator URL）

### 3. 确认告警

**操作步骤**：
1. 打开告警详情抽屉
2. 点击【确认告警】按钮
3. 在弹窗中输入处理备注（必填）
4. 点击【确认】

**确认后效果**：
- 详情抽屉顶部显示黄色确认徽章
- 显示确认人、时间和备注
- 按钮变为【取消确认】

**取消确认**：
- 点击【取消确认】按钮即可移除确认状态

### 4. 创建静默规则

**路径**：`/alerts?tab=silences`

**操作步骤**：
1. 点击【创建静默】按钮
2. 配置匹配器：
   - 标签名：如 `alertname`、`namespace`
   - 操作符：`=` 或 `!=`
   - 值：标签值
   - 正则：勾选启用正则表达式匹配
   - 可添加多个匹配器（AND 关系）
3. 选择持续时间：30分钟、1小时、2小时、4小时、8小时、24小时、7天
4. 输入备注（必填）：说明静默原因
5. 点击【创建静默】

**匹配器示例**：
```
alertname = "HighCPUUsage"
namespace = "default"
severity != "info"
instance =~ "10\\.0\\..*"  (正则)
```

### 5. 管理静默规则

**静默状态**：
- 🟢 活跃（Active）：正在生效
- 🟡 待生效（Pending）：未到开始时间
- ⚪ 已过期（Expired）：已过结束时间

**操作**：
- 查看静默详情：卡片显示所有匹配器、时间范围、创建人
- 删除静默：点击删除按钮 → 二次确认 → 立即删除

---

## 🔄 数据流与同步机制

### 告警数据流

```
Prometheus/VictoriaMetrics
    ↓ (规则评估)
Alertmanager
    ↓ (REST API 轮询)
后端 Go 服务
    ↓ (HTTP API)
前端 React 应用
    ↓ (TanStack Query 缓存)
用户界面
```

### 确认数据流

```
用户点击确认
    ↓
POST /api/v1/alerts/{fingerprint}/acknowledge
    ↓
alerts.Service.AcknowledgeAlert()
    ↓
alerts.Repository.AcknowledgeAlert()
    ↓
PostgreSQL 插入确认记录
    ↓
前端缓存失效 & 重新查询
```

### 静默规则同步

**创建流程**（双写）：
```
用户创建静默
    ↓
POST /api/v1/silences
    ↓
alerts.Service.CreateSilence()
    ├─→ alertmanager.Client.CreateSilence()  (写入 Alertmanager)
    └─→ alerts.Repository.CreateSilence()    (写入 PostgreSQL)
    ↓
返回静默规则
```

**列表查询**（双读合并）：
```
GET /api/v1/silences
    ↓
alerts.Service.ListSilences()
    ├─→ alertmanager.Client.GetSilences()    (获取 Alertmanager 数据)
    └─→ alerts.Repository.ListSilences()      (获取数据库元数据)
    ↓
合并数据（Alertmanager 为主，数据库补充 createdBy/comment）
```

**删除流程**（双删）：
```
用户删除静默
    ↓
DELETE /api/v1/silences/{id}
    ↓
alerts.Service.DeleteSilence()
    ├─→ alertmanager.Client.DeleteSilence()  (删除 Alertmanager 中的)
    └─→ alerts.Repository.DeleteSilence()    (删除数据库中的)
```

---

## 📂 代码文件清单

### 后端文件（Go）

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `backend/internal/alertmanager/client.go` | 扩展 | 新增过滤、详情、静默 CRUD 方法 |
| `backend/internal/alerts/repository.go` | 新建 | 数据仓库层，管理 PostgreSQL 表 |
| `backend/internal/alerts/service.go` | 新建 | 业务逻辑层，整合数据仓库和 Alertmanager |
| `backend/internal/api/handlers/handlers.go` | 扩展 | 新增 8 个告警相关 API Handler |
| `backend/internal/api/router.go` | 更新 | 注册新增的 API 路由 |
| `backend/cmd/server/main.go` | 更新 | 初始化告警服务 |

### 前端文件（TypeScript/React）

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `frontend/src/types/api.ts` | 扩展 | 新增告警相关类型定义 |
| `frontend/src/api/resources.ts` | 扩展 | 新增 `alertApi` 和 `silenceApi` |
| `frontend/src/pages/alerts/Alerts.tsx` | 重写 | Tab 导航容器 |
| `frontend/src/pages/alerts/AlertsActive.tsx` | 重写 | 活跃告警页面（600+ 行） |
| `frontend/src/pages/alerts/AlertsSilences.tsx` | 新建 | 静默规则页面（480+ 行） |

---

## ⏳ 待实现功能（Step 3-5）

### Step 3: 告警历史记录 ⏸️

**数据库表**：
```sql
CREATE TABLE alert_history (
  id BIGSERIAL PRIMARY KEY,
  fingerprint VARCHAR(64),
  alert_name VARCHAR(255),
  severity VARCHAR(20),
  namespace VARCHAR(255),
  summary TEXT,
  description TEXT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INT,
  labels JSONB,
  annotations JSONB
);
```

**功能需求**：
- 告警触发时自动记录到历史表
- 告警解除时更新 `ended_at` 和 `duration_seconds`
- 历史查询页面：
  - 时间范围筛选
  - 按严重级别、命名空间、告警名称过滤
  - 展示触发次数、平均持续时间
  - 导出为 CSV/JSON

**API 接口**：
```http
GET /api/v1/alerts/history?startTime={ISO8601}&endTime={ISO8601}&severity={level}&namespace={ns}
GET /api/v1/alerts/history/stats?startTime={ISO8601}&endTime={ISO8601}
POST /api/v1/alerts/history/export
```

### Step 4: 告警规则管理 ⏸️

**数据库表**：
```sql
CREATE TABLE alert_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_name VARCHAR(255) UNIQUE,
  rule_group VARCHAR(255),
  expr TEXT NOT NULL,
  duration VARCHAR(20),
  severity VARCHAR(20),
  summary_template TEXT,
  description_template TEXT,
  labels JSONB,
  annotations JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_to_vm BOOLEAN DEFAULT FALSE,
  vm_rule_id VARCHAR(255)
);
```

**功能需求**：
- 创建自定义告警规则（PromQL 表达式）
- PromQL 语法校验（调用 VictoriaMetrics API）
- 规则模板库（CPU、内存、磁盘、Pod 状态等）
- 同步到 VictoriaMetrics Operator（VMRule CRD）
- 规则启用/禁用开关
- 规则测试功能（模拟执行）

**VMRule CRD 示例**：
```yaml
apiVersion: operator.victoriametrics.com/v1beta1
kind: VMRule
metadata:
  name: custom-alert-rules
  namespace: monitoring
spec:
  groups:
  - name: cpu_rules
    rules:
    - alert: HighCPUUsage
      expr: sum(rate(container_cpu_usage_seconds_total[5m])) by (pod, namespace) > 0.8
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Pod {{ $labels.pod }} CPU usage high"
        description: "CPU usage is {{ $value | humanizePercentage }}"
```

**API 接口**：
```http
GET /api/v1/alert-rules
POST /api/v1/alert-rules
PUT /api/v1/alert-rules/{id}
DELETE /api/v1/alert-rules/{id}
POST /api/v1/alert-rules/{id}/validate
POST /api/v1/alert-rules/{id}/sync
POST /api/v1/alert-rules/{id}/test
```

**前端页面**：
- 规则列表（分组展示）
- 规则编辑器（带 PromQL 语法高亮）
- 规则模板选择器
- 同步状态指示器
- 测试结果预览

### Step 5: WebSocket 实时推送 ⏸️

**架构设计**：
```
WebSocket Hub
    ↑
多个客户端连接
    ↑
/api/v1/ws/alerts

后台 Goroutine 轮询 Alertmanager
    ↓
检测告警变化（新增/更新/解除）
    ↓
通过 Hub 广播到所有连接的客户端
```

**消息格式**：
```json
{
  "type": "alert_added",
  "data": {
    "alert": { /* 告警完整数据 */ },
    "timestamp": "2025-12-11T10:00:00Z"
  }
}

{
  "type": "alert_updated",
  "data": {
    "alert": { /* 告警完整数据 */ },
    "changes": ["state", "silencedBy"],
    "timestamp": "2025-12-11T10:05:00Z"
  }
}

{
  "type": "alert_resolved",
  "data": {
    "fingerprint": "abc123...",
    "timestamp": "2025-12-11T10:10:00Z"
  }
}
```

**后端实现**：
```go
// backend/internal/websocket/hub.go
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    register   chan *Client
    unregister chan *Client
}

// backend/internal/websocket/client.go
type Client struct {
    hub  *Hub
    conn *websocket.Conn
    send chan []byte
}

// backend/internal/alerts/watcher.go
type Watcher struct {
    alertClient *alertmanager.Client
    hub         *websocket.Hub
    interval    time.Duration
    lastAlerts  map[string]*alertmanager.Alert
}

func (w *Watcher) Start() {
    ticker := time.NewTicker(w.interval)
    for range ticker.C {
        w.checkAlerts()
    }
}

func (w *Watcher) checkAlerts() {
    // 获取最新告警
    alerts := w.alertClient.GetAlerts()

    // 对比 lastAlerts，检测变化
    for _, alert := range alerts {
        if old, exists := w.lastAlerts[alert.Fingerprint]; !exists {
            // 新增告警
            w.hub.Broadcast(WsMessage{Type: "alert_added", Data: alert})
        } else if !reflect.DeepEqual(old, alert) {
            // 更新告警
            w.hub.Broadcast(WsMessage{Type: "alert_updated", Data: alert})
        }
    }

    // 检测已解除的告警
    for fingerprint := range w.lastAlerts {
        if !contains(alerts, fingerprint) {
            w.hub.Broadcast(WsMessage{Type: "alert_resolved", Data: fingerprint})
        }
    }

    w.lastAlerts = mapAlerts(alerts)
}
```

**前端实现**：
```typescript
// frontend/src/hooks/useAlertWebSocket.ts
export function useAlertWebSocket() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:9099/api/v1/ws/alerts');

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[WebSocket] 已连接');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'alert_added':
        case 'alert_updated':
          // 失效缓存，触发重新查询
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
          // 显示桌面通知
          showNotification(message.data.alert);
          break;
        case 'alert_resolved':
          queryClient.invalidateQueries({ queryKey: ['alerts'] });
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] 错误:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('[WebSocket] 已断开');
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);

  return { isConnected };
}
```

**前端集成**：
```tsx
// frontend/src/pages/alerts/AlertsActive.tsx
export default function AlertsActive() {
  const { isConnected } = useAlertWebSocket();

  return (
    <div className="space-y-4">
      {/* WebSocket 连接状态指示器 */}
      <div className="flex items-center gap-2 text-xs">
        <div className={clsx(
          'w-2 h-2 rounded-full',
          isConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-500'
        )} />
        <span className="text-slate-400">
          {isConnected ? '实时推送已连接' : '实时推送未连接'}
        </span>
      </div>

      {/* 告警列表... */}
    </div>
  );
}
```

**性能优化**：
- 连接心跳（每 30 秒 ping/pong）
- 断线重连（指数退避）
- 消息去重（基于 fingerprint）
- 增量更新（仅传输变化字段）

---

## 🧪 测试建议

### 后端单元测试

```go
// backend/internal/alerts/service_test.go
func TestAcknowledgeAlert(t *testing.T) {
    repo := &MockRepository{}
    client := &MockAlertmanagerClient{}
    service := NewService(repo, client)

    err := service.AcknowledgeAlert("abc123", "admin", "已处理", nil)
    assert.NoError(t, err)
    assert.True(t, repo.AcknowledgeCalled)
}

func TestCreateSilence(t *testing.T) {
    // 测试同步到 Alertmanager
    // 测试数据库持久化
    // 测试错误处理
}
```

### 前端集成测试

```typescript
// frontend/src/pages/alerts/__tests__/AlertsActive.test.tsx
describe('AlertsActive', () => {
  it('should display alerts', async () => {
    render(<AlertsActive />);
    await waitFor(() => {
      expect(screen.getByText('HighCPUUsage')).toBeInTheDocument();
    });
  });

  it('should filter alerts by severity', async () => {
    render(<AlertsActive />);
    const select = screen.getByLabelText('严重级别');
    fireEvent.change(select, { target: { value: 'critical' } });
    // 验证过滤结果...
  });

  it('should acknowledge alert', async () => {
    render(<AlertsActive />);
    const alertCard = screen.getByText('HighCPUUsage');
    fireEvent.click(alertCard);
    const ackButton = screen.getByText('确认告警');
    fireEvent.click(ackButton);
    // 填写备注并提交...
  });
});
```

### API 集成测试

```bash
# 获取告警列表
curl http://localhost:9099/api/v1/alerts

# 确认告警
curl -X POST http://localhost:9099/api/v1/alerts/abc123/acknowledge \
  -H "Content-Type: application/json" \
  -H "X-User-Name: admin" \
  -d '{"comment": "已处理"}'

# 创建静默规则
curl -X POST http://localhost:9099/api/v1/silences \
  -H "Content-Type: application/json" \
  -H "X-User-Name: admin" \
  -d '{
    "matchers": [
      {"name": "alertname", "value": "HighCPUUsage", "isRegex": false, "isEqual": true}
    ],
    "startsAt": "2025-12-11T10:00:00Z",
    "endsAt": "2025-12-11T12:00:00Z",
    "comment": "维护期间静默"
  }'
```

---

## 🚀 部署检查清单

### 环境变量配置

```bash
# Alertmanager 地址（必需）
ALERTMANAGER_URL=http://alertmanager:9093

# PostgreSQL 配置（必需）
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=k8s_dashboard
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=k8s_dashboard
```

### 数据库初始化

数据库表会在服务启动时自动创建（见 `alerts.Repository.initSchema()`），无需手动执行 SQL。

如需手动创建：
```sql
-- 连接到 PostgreSQL
psql -h postgres -U k8s_dashboard -d k8s_dashboard

-- 验证表是否存在
\dt

-- 查看表结构
\d alert_acknowledgements
\d alert_silences
```

### Kubernetes 部署配置

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: k8s-dashboard-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: ALERTMANAGER_URL
          value: "http://alertmanager.monitoring.svc:9093"
        - name: POSTGRES_HOST
          value: "postgres"
        - name: POSTGRES_PORT
          value: "5432"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: POSTGRES_DB
          value: "k8s_dashboard"
```

### RBAC 权限（如需管理 VMRule CRD）

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: k8s-dashboard-vmrule-editor
rules:
- apiGroups: ["operator.victoriametrics.com"]
  resources: ["vmrules"]
  verbs: ["get", "list", "create", "update", "delete", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: k8s-dashboard-vmrule-editor-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: k8s-dashboard-vmrule-editor
subjects:
- kind: ServiceAccount
  name: k8s-dashboard
  namespace: default
```

---

## 📚 参考文档

### Alertmanager API
- 官方文档：https://prometheus.io/docs/alerting/latest/clients/
- API v2 规范：https://petstore.swagger.io/?url=https://raw.githubusercontent.com/prometheus/alertmanager/main/api/v2/openapi.yaml

### VictoriaMetrics Operator
- VMRule CRD 文档：https://docs.victoriametrics.com/operator/resources/vmrule.html
- PromQL 查询语法：https://docs.victoriametrics.com/metricsql/

### 前端依赖
- TanStack Query：https://tanstack.com/query/latest
- React Router：https://reactrouter.com/
- Tailwind CSS：https://tailwindcss.com/
- Heroicons：https://heroicons.com/

---

## 🐛 已知问题与限制

### 当前版本限制

1. **用户身份识别**：
   - 当前从 `X-User-Name` 请求头读取用户名
   - 默认用户为 "admin"
   - 待集成 Kubernetes RBAC 或 OAuth2

2. **静默规则同步**：
   - 仅在创建时同步到 Alertmanager
   - 外部修改的静默规则不会自动同步回数据库
   - 建议通过本系统统一管理静默规则

3. **告警历史**：
   - Step 1-2 未实现历史记录持久化
   - 告警解除后无法查询历史数据
   - Step 3 将实现完整的历史追溯

4. **实时性**：
   - 当前依赖 30 秒轮询
   - Step 5 将实现 WebSocket 实时推送

5. **PromQL 校验**：
   - 创建告警规则时无语法校验
   - Step 4 将集成 VictoriaMetrics 校验 API

### 待优化项

- [ ] 添加单元测试和集成测试
- [ ] 前端错误边界处理
- [ ] API 响应时间监控
- [ ] 数据库查询性能优化（索引）
- [ ] WebSocket 连接池管理
- [ ] 告警通知渠道（邮件、钉钉、Slack）

---

## 📝 更新日志

### v1.0 (2025-12-11)

**新增**：
- ✅ 活跃告警展示（多维度过滤、详情查看）
- ✅ 告警确认系统（确认/取消、备注记录）
- ✅ 静默规则管理（创建、列表、删除）
- ✅ 自动同步到 Alertmanager
- ✅ PostgreSQL 持久化存储
- ✅ 三层架构（Repository-Service-Handler）
- ✅ React + TypeScript 前端

**待开发**（Step 3-5）：
- ⏸️ 告警历史记录
- ⏸️ 自定义告警规则（VMRule CRD）
- ⏸️ WebSocket 实时推送

---

## 👥 贡献者

- **设计与实现**：Claude Code Assistant
- **需求提供**：项目维护者
- **技术架构**：Go + Gin + PostgreSQL + React + TypeScript

---

**文档结束**

如有问题或建议，请在项目 Issue 中反馈。
