import { Link } from 'react-router-dom';
import { HomeIcon } from '@heroicons/react/24/outline';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-9xl font-bold text-slate-700">404</h1>
      <p className="text-xl text-slate-400 mt-4">页面未找到</p>
      <p className="text-slate-500 mt-2">您访问的页面不存在或已被移除</p>
      <Link to="/dashboard" className="btn btn-primary mt-8 flex items-center gap-2">
        <HomeIcon className="w-5 h-5" />
        返回首页
      </Link>
    </div>
  );
}
