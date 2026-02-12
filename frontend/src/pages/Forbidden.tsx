import { Link } from 'react-router-dom';

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div
        className="max-w-md w-full rounded-xl p-8 text-center"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h1 className="text-3xl font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          403
        </h1>
        <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          你没有权限访问该页面。
        </p>
        <Link className="btn btn-primary" to="/dashboard">
          返回仪表盘
        </Link>
      </div>
    </div>
  );
}
