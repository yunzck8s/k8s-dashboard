import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: 'up' | 'down';
  onClick?: () => void;
  isSelected?: boolean;
}

const colorStyles = {
  blue: {
    bg: 'rgba(0, 153, 255, 0.1)',
    border: '#0099ff',
    glow: 'rgba(0, 153, 255, 0.4)',
    iconBg: 'rgba(0, 212, 255, 0.15)',
    iconColor: '#00d4ff',
  },
  green: {
    bg: 'rgba(0, 255, 136, 0.1)',
    border: '#00ff88',
    glow: 'rgba(0, 255, 136, 0.4)',
    iconBg: 'rgba(0, 255, 136, 0.15)',
    iconColor: '#00ff88',
  },
  purple: {
    bg: 'rgba(168, 85, 247, 0.1)',
    border: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.4)',
    iconBg: 'rgba(168, 85, 247, 0.15)',
    iconColor: '#a855f7',
  },
  orange: {
    bg: 'rgba(251, 146, 60, 0.1)',
    border: '#fb923c',
    glow: 'rgba(251, 146, 60, 0.4)',
    iconBg: 'rgba(251, 146, 60, 0.15)',
    iconColor: '#fb923c',
  },
  red: {
    bg: 'rgba(255, 68, 68, 0.1)',
    border: '#ff4444',
    glow: 'rgba(255, 68, 68, 0.4)',
    iconBg: 'rgba(255, 68, 68, 0.15)',
    iconColor: '#ff4444',
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  onClick,
  isSelected,
}: StatsCardProps) {
  const styles = colorStyles[color];
  const isClickable = !!onClick;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const valueRef = useRef(0);

  // 数字动画效果
  useEffect(() => {
    if (typeof value === 'number') {
      const start = valueRef.current;
      const end = value;
      const duration = 1000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const current = start + (end - start) * easeOutCubic;

        setDisplayValue(Math.round(current));
        valueRef.current = current;

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }
  }, [value]);

  // 六边形网格背景动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const hexSize = 20;
    const hexagons: Array<{ x: number; y: number; opacity: number; delay: number }> = [];

    // 生成六边形位置
    for (let y = -hexSize; y < canvas.offsetHeight + hexSize; y += hexSize * 1.5) {
      for (let x = -hexSize; x < canvas.offsetWidth + hexSize; x += hexSize * Math.sqrt(3)) {
        hexagons.push({
          x: x + (y % (hexSize * 3) === 0 ? hexSize * Math.sqrt(3) / 2 : 0),
          y,
          opacity: Math.random() * 0.3,
          delay: Math.random() * 2000,
        });
      }
    }

    let animationId: number;
    const startTime = Date.now();

    const drawHexagon = (x: number, y: number, size: number, opacity: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.strokeStyle = `${styles.border}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const elapsed = Date.now() - startTime;

      hexagons.forEach((hex) => {
        const phase = (elapsed + hex.delay) / 2000;
        const opacity = hex.opacity * (0.5 + 0.5 * Math.sin(phase * Math.PI));
        drawHexagon(hex.x, hex.y, hexSize / 2, opacity);
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [styles.border]);

  const cardContent = (
    <>
      {/* 六边形背景 Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* 顶部发光线 */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${styles.border}, transparent)`,
          boxShadow: `0 0 10px ${styles.glow}`,
        }}
      />

      {/* 左侧垂直线 */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[2px]"
        style={{
          background: `linear-gradient(180deg, ${styles.border}, transparent)`,
          opacity: 0.5,
        }}
      />

      {/* 内容 */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{
              color: styles.iconColor,
              fontFamily: 'Rajdhani, sans-serif',
              letterSpacing: '1px',
            }}
          >
            {title}
          </p>
          <p
            className="text-3xl font-bold mb-1 digit-flicker"
            style={{
              color: styles.iconColor,
              fontFamily: 'JetBrains Mono, monospace',
              textShadow: `0 0 15px ${styles.glow}`,
            }}
          >
            {typeof value === 'number' ? displayValue : value}
          </p>
          {subtitle && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div
          className="p-3 rounded relative overflow-hidden"
          style={{
            background: styles.iconBg,
            border: `1px solid ${styles.border}`,
          }}
        >
          <Icon className="w-6 h-6 relative z-10" style={{ color: styles.iconColor }} />
          {/* 图标发光效果 */}
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background: `radial-gradient(circle at center, ${styles.glow}, transparent)`,
            }}
          />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2 relative z-10">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
            style={{
              background: trend === 'up' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 68, 68, 0.15)',
              border: trend === 'up' ? '1px solid #00ff88' : '1px solid #ff4444',
              color: trend === 'up' ? '#00ff88' : '#ff4444',
              fontFamily: 'Rajdhani, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            <span className="text-base">{trend === 'up' ? '↑' : '↓'}</span>
            <span>{trend === 'up' ? '正常' : '警告'}</span>
          </div>
        </div>
      )}

      {/* 右下角装饰 */}
      <div
        className="absolute bottom-0 right-0 w-8 h-8 opacity-20"
        style={{
          borderRight: `2px solid ${styles.border}`,
          borderBottom: `2px solid ${styles.border}`,
        }}
      />
    </>
  );

  const baseClasses = clsx(
    'relative p-6 transition-all duration-300',
    'backdrop-blur-sm',
  );

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className={clsx(baseClasses, 'w-full text-left cursor-pointer transform hover:scale-[1.02]')}
        style={{
          background: isSelected ? styles.bg : 'var(--color-bg-secondary)',
          border: `1px solid ${isSelected ? styles.border : 'var(--color-border)'}`,
          boxShadow: isSelected ? `0 0 30px ${styles.glow}` : '0 0 10px rgba(0, 0, 0, 0.3)',
        }}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div
      className={baseClasses}
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 0 15px rgba(0, 0, 0, 0.3)',
      }}
    >
      {cardContent}
    </div>
  );
}
