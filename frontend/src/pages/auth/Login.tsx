import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/auth';
import {
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // 获取重定向目标
  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';

  // 登录 mutation
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.token, data.namespaces);
      navigate(from, { replace: true });
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      const message = err.response?.data?.error || '登录失败，请检查用户名和密码';
      setError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'var(--color-primary)' }}
          >
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            K8s Dashboard
          </h1>
          <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            Kubernetes 集群管理平台
          </p>
        </div>

        {/* 登录表单 */}
        <div
          className="rounded-xl shadow-xl p-8"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 错误提示 */}
            {error && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#F87171',
                }}
              >
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* 用户名 */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg px-4 py-3 transition-all duration-150"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                placeholder="请输入用户名"
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* 密码 */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 pr-12 transition-all duration-150"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full font-medium py-3 px-4 rounded-lg transition-all duration-150 flex items-center justify-center gap-2"
              style={{
                background: loginMutation.isPending ? 'rgba(99, 102, 241, 0.5)' : 'var(--color-primary)',
                color: 'white',
              }}
            >
              {loginMutation.isPending ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </button>
          </form>

          {/* 提示信息 */}
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
              默认管理员账号:{' '}
              <span style={{ color: 'var(--color-text-secondary)' }}>admin</span> /{' '}
              <span style={{ color: 'var(--color-text-secondary)' }}>admin123</span>
            </p>
          </div>
        </div>

        {/* 版权信息 */}
        <p className="text-center text-sm mt-8" style={{ color: 'var(--color-text-muted)' }}>
          © 2024 K8s Dashboard. All rights reserved.
        </p>
      </div>
    </div>
  );
}
