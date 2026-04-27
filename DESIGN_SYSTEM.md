# Kubernetes Dashboard 设计系统

## 设计定位

本项目采用数据密集型企业运维台风格：信息层级清晰、状态可快速扫描、操作路径直接。默认新用户进入 `dark` 主题；已存在的 `localStorage` 主题偏好不覆盖。

核心原则：
- 优先保证可读性、密度和状态识别，不做装饰性大面积视觉噪声。
- 关键操作使用明确的语义色：成功、警告、危险、信息。
- 列表、详情页、YAML、日志和指标视图保持一致的 spacing、边框和字体规则。
- 组件状态必须来自 `frontend/src/index.css` 中的 CSS variables 和 component classes。

## 字体

字体在 `frontend/src/index.css` 中注册：

```css
--font-heading: 'Lexend', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-body: 'Source Sans 3', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono: 'Fira Code', 'IBM Plex Mono', monospace;
```

用途：
- `Lexend`：页面标题、关键 KPI、导航品牌。
- `Source Sans 3`：正文、表格、按钮、菜单。
- `Fira Code`：YAML、日志、镜像、UID、命令、资源配额等数据字段。

## 主题 Token

主题通过 `data-theme` 切换，基础 token 名称保持一致：

```css
--color-bg-primary
--color-bg-secondary
--color-bg-tertiary
--color-bg-elevated
--color-text-primary
--color-text-secondary
--color-text-muted
--color-primary
--color-primary-hover
--color-primary-light
--color-success
--color-warning
--color-error
--color-info
--color-border
--color-border-hover
--color-focus-ring
```

实现约定：
- 新增 UI 优先使用 `var(--color-*)`，避免硬编码主题色。
- 状态软底色使用 `--sys-success-soft-*`、`--sys-warning-soft-*`、`--sys-error-soft-*`、`--sys-info-soft-*`。
- 图表色使用 `--chart-color-1` 到 `--chart-color-8`。

## 组件类

常用组件类定义在 `frontend/src/index.css`：

```tsx
<button className="btn btn-primary">主要操作</button>
<button className="btn btn-secondary">次要操作</button>
<button className="btn btn-danger">删除</button>
<button className="btn btn-warning">暂停</button>
<button className="btn btn-error">错误操作</button>
<button className="btn btn-outline">轮廓按钮</button>
<button className="btn btn-ghost">低强调操作</button>
<button className="btn btn-sm">小按钮</button>

<div className="card p-6">内容</div>

<input className="input" />
<select className="select select-sm" />

<span className="badge badge-success">Running</span>
<span className="badge badge-warning">Pending</span>
<span className="badge badge-error">Failed</span>
<span className="badge badge-info">Info</span>
<span className="badge badge-purple">Custom</span>
<span className="badge badge-default">Unknown</span>
```

约束：
- 按钮默认最小高度 `44px`，`btn-sm` 为 `36px`。
- 卡片用于资源组、详情块和重复实体，不把整页 section 包成多层 card。
- 表格外层使用 `table-container`，保持横向滚动和边框一致。

## 布局规则

Shell 布局：
- `Sidebar` 在 `<md` 视口强制使用 64px 图标模式。
- 主内容区在移动端使用 `ml-16`，桌面端按折叠状态切换 `ml-16` / `ml-64`。
- `Header` 在窄屏隐藏搜索框，右侧操作区允许换行，命名空间和集群选择器文本截断。

页面布局：
- 列表页使用标题区 + 操作区 + `card overflow-hidden` 表格。
- 详情页使用返回按钮、状态 badge、操作按钮、tab 导航和分区内容。
- YAML/日志区域使用 `font-mono`、固定最大高度和内部滚动。

## 交互与可访问性

- 所有可点击操作必须有 disabled/loading 状态，避免重复提交。
- 删除、暂停、恢复、触发等操作必须接入真实后端 API，不能暴露会 404 的按钮。
- 窄屏下内容不能被 Sidebar 或 Header 遮挡；表格可以横向滚动，但主布局不应整体溢出。
- `:focus-visible` 使用统一 focus ring，菜单和按钮保留键盘可达性。

## 回归检查

相关校验命令：

```bash
cd frontend && npm run test:smoke
cd frontend && npm run ci:verify
cd backend && go test ./...
make test
```

`frontend/scripts/smoke-integration.mjs` 会检查前端路由、关键页面占位文案和前后端 API 契约。新增 API 封装时必须同步后端路由，或先不要暴露该方法。
