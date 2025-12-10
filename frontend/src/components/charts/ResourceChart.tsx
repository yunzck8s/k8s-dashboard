import { formatResourceUsage, getUsageColor, getUsageLevel } from '../../utils/format';
import clsx from 'clsx';
import { useMemo } from 'react';

interface ResourceChartProps {
  used: number;
  total: number;
  unit: string;
  color?: string;
  title?: string;
  showLegend?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

// 生成气泡数据
interface Bubble {
  id: number;
  angle: number;      // 气泡在圆环上的角度位置
  size: number;       // 气泡大小
  delay: number;      // 动画延迟
  duration: number;   // 动画时长
  opacity: number;    // 透明度
}

export default function ResourceChart({
  used,
  total,
  unit,
  color,
  title,
  showLegend = true,
  onClick,
  isSelected,
}: ResourceChartProps) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const radius = 70;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // 生成气泡 - 只在有使用量时显示
  const bubbles = useMemo<Bubble[]>(() => {
    if (percentage < 5) return []; // 使用率太低时不显示气泡

    const bubbleCount = Math.min(Math.floor(percentage / 10) + 2, 8); // 根据使用率调整气泡数量
    const maxAngle = (percentage / 100) * 360; // 气泡只出现在使用量范围内

    return Array.from({ length: bubbleCount }, (_, i) => ({
      id: i,
      angle: (maxAngle * (i + 0.5)) / bubbleCount - 90, // 从顶部开始（-90度）
      size: 2 + Math.random() * 3, // 2-5px
      delay: Math.random() * 3, // 0-3秒延迟
      duration: 2 + Math.random() * 2, // 2-4秒动画时长
      opacity: 0.4 + Math.random() * 0.4, // 0.4-0.8 透明度
    }));
  }, [percentage]);

  // 计算气泡在圆环上的位置
  const getBubblePosition = (angle: number, offset: number = 0) => {
    const rad = (angle * Math.PI) / 180;
    const r = radius + offset;
    return {
      x: 90 + r * Math.cos(rad),
      y: 90 + r * Math.sin(rad),
    };
  };

  // 根据使用率自动选择颜色
  const chartColor = color || getUsageColor(percentage);
  const level = getUsageLevel(percentage);

  // 格式化显示
  const formatted = formatResourceUsage(used, total, unit);

  // 使用率等级对应的样式
  const levelStyles = {
    low: { text: 'text-green-400', bg: 'bg-green-500/10', ring: 'ring-green-500/50', border: 'border-green-500/30' },
    medium: { text: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/50', border: 'border-blue-500/30' },
    high: { text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/50', border: 'border-amber-500/30' },
    critical: { text: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/50', border: 'border-red-500/30' },
  };

  const isClickable = !!onClick;
  const currentLevelStyle = levelStyles[level];

  const chartContent = (
    <>
      {/* 气泡动画 CSS */}
      <style>
        {`
          @keyframes bubble-float {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              opacity: var(--bubble-opacity);
            }
            25% {
              transform: translate(-2px, -4px) scale(1.2);
              opacity: calc(var(--bubble-opacity) * 1.2);
            }
            50% {
              transform: translate(2px, -6px) scale(0.9);
              opacity: calc(var(--bubble-opacity) * 0.8);
            }
            75% {
              transform: translate(-1px, -3px) scale(1.1);
              opacity: calc(var(--bubble-opacity) * 1.1);
            }
          }
          @keyframes bubble-pulse {
            0%, 100% {
              r: var(--bubble-size);
              opacity: var(--bubble-opacity);
            }
            50% {
              r: calc(var(--bubble-size) * 1.3);
              opacity: calc(var(--bubble-opacity) * 0.6);
            }
          }
          @keyframes glow-pulse {
            0%, 100% {
              filter: drop-shadow(0 0 6px var(--glow-color));
            }
            50% {
              filter: drop-shadow(0 0 12px var(--glow-color));
            }
          }
          @keyframes spin {
            from {
              stroke-dashoffset: 0;
            }
            to {
              stroke-dashoffset: -${circumference};
            }
          }
        `}
      </style>
      {/* 圆环图 */}
      <div className="relative">
        <svg width="180" height="180" className="transform -rotate-90">
          <defs>
            {/* 气泡渐变 */}
            <radialGradient id={`bubble-gradient-${percentage}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor={chartColor} stopOpacity="0.3" />
            </radialGradient>
            {/* 发光效果 */}
            <filter id={`glow-${percentage}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 背景圆环 */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-slate-700/50"
          />
          {/* 进度圆环 */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke={chartColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${chartColor}40)`,
              ['--glow-color' as string]: `${chartColor}60`,
              animation: 'glow-pulse 3s ease-in-out infinite',
            }}
          />

          {/* 气泡效果 */}
          {bubbles.map((bubble) => {
            const pos = getBubblePosition(bubble.angle, 0);
            return (
              <circle
                key={bubble.id}
                cx={pos.x}
                cy={pos.y}
                r={bubble.size}
                fill={`url(#bubble-gradient-${percentage})`}
                filter={`url(#glow-${percentage})`}
                style={{
                  ['--bubble-size' as string]: `${bubble.size}px`,
                  ['--bubble-opacity' as string]: bubble.opacity,
                  animation: `bubble-pulse ${bubble.duration}s ease-in-out ${bubble.delay}s infinite`,
                  transformOrigin: `${pos.x}px ${pos.y}px`,
                }}
              />
            );
          })}

          {/* 额外的流动光点效果 */}
          {percentage > 10 && (
            <>
              <circle
                cx="90"
                cy="90"
                r={radius}
                stroke="white"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="4 50"
                strokeDashoffset={strokeDashoffset}
                opacity="0.3"
                style={{
                  animation: 'spin 8s linear infinite',
                }}
              />
            </>
          )}
        </svg>
        {/* 中心内容 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={clsx('text-4xl font-bold', currentLevelStyle.text)}
            style={{ color: chartColor }}
          >
            {percentage.toFixed(1)}%
          </span>
          {title && <span className="text-xs text-slate-500 mt-1">{title}</span>}
        </div>
      </div>

      {/* 图例 */}
      {showLegend && (
        <div className="mt-4 text-center">
          <div className="text-lg font-semibold text-white">
            {formatted.usedStr} <span className="text-slate-500">/</span>{' '}
            {formatted.totalStr} <span className="text-slate-400 text-sm">{formatted.unit}</span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: chartColor }}
              />
              <span className="text-xs text-slate-400">已使用</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-700" />
              <span className="text-xs text-slate-400">剩余</span>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          'flex flex-col items-center p-4 rounded-xl border transition-all',
          isSelected ? currentLevelStyle.bg : 'bg-transparent',
          isSelected ? currentLevelStyle.border : 'border-transparent',
          isSelected && 'ring-2',
          isSelected && currentLevelStyle.ring,
          'hover:bg-slate-700/30 hover:scale-[1.02]'
        )}
      >
        {chartContent}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {chartContent}
    </div>
  );
}
