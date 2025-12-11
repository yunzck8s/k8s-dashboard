// 动画演示组件 - 可以在任意页面导入使用
import { useState } from 'react';

export default function AnimationDemo() {
  const [showDemo, setShowDemo] = useState(false);

  if (!showDemo) {
    return (
      <button
        onClick={() => setShowDemo(true)}
        className="fixed bottom-4 right-4 btn btn-primary z-50"
      >
        查看动画演示
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8 overflow-auto">
      <div className="max-w-4xl w-full bg-slate-900 rounded-lg p-8 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">动画效果演示</h2>
          <button onClick={() => setShowDemo(false)} className="btn btn-ghost">
            关闭
          </button>
        </div>

        {/* 淡入动画 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">1. 淡入动画</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 animate-fade-in">
              <p className="text-white">即时淡入</p>
            </div>
            <div className="card p-4 animate-fade-in-delay-1">
              <p className="text-white">延迟 0.1s</p>
            </div>
            <div className="card p-4 animate-fade-in-delay-2">
              <p className="text-white">延迟 0.2s</p>
            </div>
          </div>
        </div>

        {/* 滑入动画 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">2. 滑入动画</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 animate-slide-in-left">
              <p className="text-white">从左滑入</p>
            </div>
            <div className="card p-4 animate-slide-in-right">
              <p className="text-white">从右滑入</p>
            </div>
          </div>
        </div>

        {/* 悬停发光 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">3. 悬停发光</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 hover-glow cursor-pointer">
              <p className="text-white">悬停查看效果</p>
            </div>
            <div className="card p-4 hover-glow cursor-pointer">
              <p className="text-white">悬停查看效果</p>
            </div>
            <div className="card p-4 hover-glow cursor-pointer">
              <p className="text-white">悬停查看效果</p>
            </div>
          </div>
        </div>

        {/* 波纹效果 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">4. 波纹效果</h3>
          <button className="btn btn-primary ripple-effect">
            点击查看波纹
          </button>
        </div>

        {/* 脉冲边框 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">5. 脉冲边框</h3>
          <div className="card p-4 animate-pulse-border">
            <p className="text-white">脉冲边框动画</p>
          </div>
        </div>

        {/* 脉冲发光 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">6. 脉冲发光</h3>
          <div className="card p-4 animate-pulse-glow">
            <p className="text-white">脉冲发光动画</p>
          </div>
        </div>

        {/* 骨架屏加载 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">7. 骨架屏加载</h3>
          <div className="space-y-2">
            <div className="skeleton h-4 w-3/4"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-5/6"></div>
          </div>
        </div>

        {/* 数据流动 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">8. 数据流动</h3>
          <div className="flex gap-4">
            <div className="data-stream text-cyan-400 text-2xl">▼</div>
            <div className="data-stream text-cyan-400 text-2xl" style={{ animationDelay: '0.5s' }}>▼</div>
            <div className="data-stream text-cyan-400 text-2xl" style={{ animationDelay: '1s' }}>▼</div>
          </div>
        </div>

        {/* 数字闪烁 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-cyan-400">9. 数字闪烁</h3>
          <div className="flex gap-4 text-4xl font-bold text-white font-mono">
            <span className="digit-flicker">42</span>
            <span className="digit-flicker">100</span>
            <span className="digit-flicker">256</span>
          </div>
        </div>

        <div className="text-center text-slate-400 text-sm mt-8">
          <p>这些动画已应用于整个应用中</p>
          <p>表格行会自动带有入场动画</p>
        </div>
      </div>
    </div>
  );
}
