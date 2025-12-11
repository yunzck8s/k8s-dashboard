# Kubernetes Dashboard - Mission Control 设计系统

## 设计理念

**"Mission Control"** - 灵感来自太空任务控制中心和高科技指挥室,打造具有未来感和技术感的企业级 Kubernetes 管理界面。

### 核心特征
- **高对比度**: 清晰的信息层次和数据可读性
- **技术美学**: 工业设计与未来主义的完美融合
- **精准性**: 专注于实时监控和精确的数据展示
- **沉浸感**: 通过动画和视觉效果营造科技氛围

---

## 配色系统

### 主色调

```css
/* 背景色 - 深空黑 */
--color-bg-primary: #0a0e1a;      /* 主背景 */
--color-bg-secondary: #0f1419;    /* 卡片背景 */
--color-bg-tertiary: #151b26;     /* 输入框背景 */
--color-bg-elevated: #1a2332;     /* 悬浮层背景 */

/* 文本色 */
--color-text-primary: #e8f0ff;    /* 主文本 */
--color-text-secondary: #8b9bb3;  /* 次要文本 */
--color-text-muted: #5a6b85;      /* 禁用/说明文本 */

/* 强调色 - 电子青 */
--color-accent-primary: #00d4ff;  /* 主强调色 */
--color-accent-secondary: #0099ff; /* 次强调色 */

/* 成功色 - 矩阵绿 */
--color-success: #00ff88;         /* 成功/运行状态 */

/* 边框色 */
--color-border: #1e2a3d;          /* 默认边框 */
--color-border-bright: #2d4059;   /* 高亮边框 */
```

### 语义化颜色

```tsx
// 状态颜色
Running:   #00ff88 (矩阵绿)
Pending:   #ffc107 (警告黄)
Failed:    #ff4444 (错误红)
Succeeded: #00d4ff (电子青)
Unknown:   #5a6b85 (静默灰)
```

---

## 字体系统

### 主字体

```css
/* 标题和 UI 文字 */
font-family: 'Rajdhani', sans-serif;

/* 代码和数据显示 */
font-family: 'JetBrains Mono', 'Consolas', monospace;
```

### 字体用途

- **Rajdhani**: 用于标题、按钮、导航项、标签等 UI 元素
  - 特点: 几何形态、高科技感、易读性强
  - 权重: 400 (常规), 500 (中等), 600 (半粗), 700 (粗体)

- **JetBrains Mono**: 用于数据、代码、日志、终端等内容
  - 特点: 等宽字体、代码优化、数字清晰
  - 权重: 400 (常规), 500 (中等), 600 (半粗), 700 (粗体)

---

## 组件样式

### 按钮 (Button)

```tsx
// 主要按钮
<button className="btn btn-primary">确认操作</button>

// 次要按钮
<button className="btn btn-secondary">取消</button>

// 危险按钮
<button className="btn btn-danger">删除</button>

// 成功按钮
<button className="btn btn-success">启动</button>

// 幽灵按钮
<button className="btn btn-ghost">更多</button>
```

**特性**:
- 渐变背景 + 发光效果
- Hover 扫光动画
- 大写字母 + 字母间距
- 过渡动画: 300ms

### 卡片 (Card)

```tsx
<div className="card p-6">
  {/* 内容 */}
</div>

// 发光强调卡片
<div className="card card-glow p-6">
  {/* 内容 */}
</div>
```

**特性**:
- 顶部渐变发光线
- 左侧垂直装饰线
- 右下角边框装饰
- Hover 发光效果

### 徽章 (Badge)

```tsx
<span className="badge badge-success">Running</span>
<span className="badge badge-warning">Pending</span>
<span className="badge badge-error">Failed</span>
<span className="badge badge-info">Info</span>
<span className="badge badge-default">Unknown</span>
```

**特性**:
- 半透明背景
- 发光边框
- 文字发光效果
- 大写 + 字母间距

### 输入框 (Input)

```tsx
<input className="input" placeholder="输入内容..." />
<select className="select">
  <option>选项 1</option>
</select>
```

**特性**:
- Focus 时边框发光
- 平滑过渡动画
- 等宽字体显示

---

## 特殊组件

### StatsCard (统计卡片)

增强的统计卡片组件,具有以下特性:

- **六边形网格背景**: Canvas 动画,呼吸效果
- **数字动画**: 数值变化时平滑过渡
- **发光边框**: 顶部和左侧装饰线
- **图标发光**: 图标背景径向渐变
- **趋势指示器**: 上升/下降状态显示

```tsx
<StatsCard
  title="Pods"
  value={42}
  subtitle="35 运行中"
  icon={CubeIcon}
  color="green"
  trend="up"
/>
```

---

## 视觉效果

### 动画列表

```css
/* 淡入动画 */
.animate-fade-in              /* 基础淡入 */
.animate-fade-in-delay-1      /* 延迟0.1s淡入 */
.animate-fade-in-delay-2      /* 延迟0.2s淡入 */
.animate-fade-in-delay-3      /* 延迟0.3s淡入 */

/* 滑入动画 */
.animate-slide-in-left        /* 从左滑入 */
.animate-slide-in-right       /* 从右滑入 */

/* 悬停效果 */
.hover-glow                   /* 悬停时发光并上浮 */

/* 交互效果 */
.ripple-effect                /* 点击波纹效果 */

/* 循环动画 */
.animate-pulse-glow           /* 发光脉冲 */
.animate-pulse-border         /* 边框脉冲 */
.data-stream                  /* 数据流动 */
.digit-flicker                /* 数字闪烁 */
.border-flow                  /* 边框流动 */

/* 加载效果 */
.skeleton                     /* 骨架屏加载动画 */

/* 特殊效果 */
.typing-effect                /* 打字机效果 */
```

### 表格自动动画

所有表格行（`<tbody><tr>`）会自动带有入场动画：
- 每行从左滑入
- 递增延迟效果（前10行）
- 给人流畅的数据加载感

### 全局效果

1. **网格背景**
   - 32px × 32px 网格
   - 电子青色线条
   - 透明度 8%

2. **角落装饰**
   - 四角 L 形边框
   - 圆点装饰
   - 固定定位
   - 40% 透明度

### 动画使用示例

#### 页面入场动画

```tsx
// 逐个淡入的卡片
<div className="animate-fade-in">第一个卡片</div>
<div className="animate-fade-in-delay-1">第二个卡片</div>
<div className="animate-fade-in-delay-2">第三个卡片</div>
```

#### 交互动画

```tsx
// 悬停发光
<div className="card hover-glow">
  卡片内容
</div>

// 点击波纹
<button className="btn btn-primary ripple-effect">
  点击我
</button>
```

#### 加载状态

```tsx
// 骨架屏
{isLoading && (
  <div className="space-y-2">
    <div className="skeleton h-4 w-3/4"></div>
    <div className="skeleton h-4 w-full"></div>
    <div className="skeleton h-4 w-5/6"></div>
  </div>
)}
```

#### 数据展示

```tsx
// 数字闪烁效果
<span className="text-4xl font-bold digit-flicker">
  {value}
</span>

// 数据流动指示器
<div className="data-stream text-cyan-400">▼</div>
```

---

## 表格样式

```tsx
<div className="table-container">
  <table>
    <thead>
      <tr>
        <th>名称</th>
        <th>状态</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>pod-123</td>
        <td className="status-running">Running</td>
      </tr>
    </tbody>
  </table>
</div>
```

**特性**:
- 表头电子青色下划线
- 行 Hover 时左侧青色边框
- 半透明背景高亮
- 等宽字体数据显示

---

## 布局系统

### Sidebar (侧边栏)

```tsx
<div className="sidebar-item">导航项</div>
<div className="sidebar-item sidebar-item-active">当前页</div>
```

**特性**:
- Hover 发光效果
- Active 状态青色高亮
- 平滑过渡动画

### 响应式

```css
/* 移动端隐藏 */
.hide-mobile
```

---

## 使用建议

### 1. 颜色使用
- **主色 (电子青)**: 用于强调、链接、按钮、高亮
- **成功色 (矩阵绿)**: 用于成功状态、运行中、正常
- **警告色 (黄色)**: 用于警告、待处理
- **错误色 (红色)**: 用于错误、失败、危险操作

### 2. 字体使用
- **标题**: Rajdhani, 600-700 weight
- **正文**: JetBrains Mono, 400 weight
- **数据**: JetBrains Mono, 500 weight
- **按钮**: Rajdhani, 600 weight, 大写

### 3. 间距
- 小间距: 0.5rem (8px)
- 中间距: 1rem (16px)
- 大间距: 1.5rem (24px)
- 超大间距: 2rem (32px)

### 4. 动画原则
- 过渡时间: 200-300ms (快速响应)
- 入场动画: 500-800ms (吸引注意)
- 循环动画: 2-8s (背景氛围)
- 缓动函数: ease-in-out 或 cubic-bezier

---

## 开发指南

### 引入字体

字体已在 `index.css` 中引入:

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap');
```

### CSS 变量使用

```tsx
// 在组件中使用
<div style={{
  background: 'var(--color-bg-secondary)',
  color: 'var(--color-text-primary)',
  borderColor: 'var(--color-accent-primary)'
}}>
  内容
</div>
```

### Tailwind 扩展

大部分样式已通过 `@layer components` 定义,可直接使用 class:

```tsx
<button className="btn btn-primary">按钮</button>
<div className="card p-6">卡片</div>
<span className="badge badge-success">徽章</span>
```

---

## 进阶定制

### 自定义颜色主题

如需修改主题色,编辑 `frontend/src/index.css` 中的 CSS 变量:

```css
:root {
  --color-accent-primary: #YOUR_COLOR;
  --color-success: #YOUR_COLOR;
  /* ... */
}
```

### 添加新动画

在 `index.css` 中添加 keyframes:

```css
@keyframes your-animation {
  0% { /* 起始状态 */ }
  100% { /* 结束状态 */ }
}

.your-class {
  animation: your-animation 2s ease-in-out infinite;
}
```

---

## 最佳实践

### ✅ 推荐

- 使用 CSS 变量保持一致性
- 为重要数据添加 `digit-flicker` 动画
- 卡片使用 `card` class 基础样式
- 状态使用语义化 class (`.status-running` 等)
- 按钮使用大写文字增强科技感

### ❌ 避免

- 不要过度使用动画(性能考虑)
- 不要使用纯白色文字(使用 `--color-text-primary`)
- 不要使用纯黑色背景(使用 `--color-bg-*`)
- 避免混合多种字体
- 避免使用低对比度颜色组合

---

## 效果预览

启动开发服务器查看完整效果:

```bash
cd frontend
npm run dev
```

访问 `http://localhost:5173` 即可看到新的 Mission Control 设计系统。

---

**设计系统版本**: 1.0.0
**最后更新**: 2025-12-11
