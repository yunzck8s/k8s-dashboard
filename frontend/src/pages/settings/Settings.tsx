import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type Session } from '../../api/auth';
import { useAppStore } from '../../store';
import { useAuthStore } from '../../store/auth';

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-CN');
}

function isCurrentTheme(theme: 'dark' | 'light', current: 'dark' | 'light'): boolean {
  return theme === current;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme, refreshInterval, setRefreshInterval } = useAppStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => authApi.getSessions(),
  });

  const sessions = useMemo<Session[]>(() => sessionsData?.items ?? [], [sessionsData]);

  const changePasswordMutation = useMutation({
    mutationFn: (payload: { oldPassword: string; newPassword: string }) => authApi.changePassword(payload),
    onSuccess: () => {
      setMessage('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      setMessage((error as Error).message || '密码修改失败');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionID: string) => authApi.revokeSession(sessionID),
    onSuccess: async () => {
      setMessage('会话已撤销');
      await queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
    onError: (error) => {
      setMessage((error as Error).message || '撤销会话失败');
    },
  });

  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');

    if (!oldPassword.trim()) {
      setMessage('旧密码不能为空');
      return;
    }
    if (newPassword.length < 6) {
      setMessage('新密码长度至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('两次输入的新密码不一致');
      return;
    }

    await changePasswordMutation.mutateAsync({
      oldPassword,
      newPassword,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          设置
        </h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          账户安全、会话管理和个人偏好配置
        </p>
      </div>

      {message && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          {message}
        </div>
      )}

      <section className="card p-5">
        <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
          账户信息
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>用户名</div>
            <div style={{ color: 'var(--color-text-primary)' }}>{user?.username || '-'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>显示名称</div>
            <div style={{ color: 'var(--color-text-primary)' }}>{user?.displayName || '-'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>邮箱</div>
            <div style={{ color: 'var(--color-text-primary)' }}>{user?.email || '-'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)' }}>角色</div>
            <div style={{ color: 'var(--color-text-primary)' }}>{user?.role || '-'}</div>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
          修改密码
        </h2>
        <form className="space-y-4 max-w-xl" onSubmit={submitPasswordChange}>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              旧密码
            </label>
            <input
              type="password"
              className="input"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              新密码（至少 6 位）
            </label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              确认新密码
            </label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? '提交中...' : '更新密码'}
          </button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
          会话管理
        </h2>
        {sessionsLoading ? (
          <div className="py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            正在加载会话...
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>IP</th>
                  <th>User Agent</th>
                  <th>创建时间</th>
                  <th>过期时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.ip || '-'}</td>
                    <td className="max-w-[420px] truncate" title={session.userAgent}>
                      {session.userAgent || '-'}
                    </td>
                    <td>{formatDateTime(session.createdAt)}</td>
                    <td>{formatDateTime(session.expiresAt)}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        onClick={() => revokeMutation.mutate(session.id)}
                        disabled={revokeMutation.isPending}
                      >
                        撤销
                      </button>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
                      暂无会话
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
          偏好设置
        </h2>

        <div className="space-y-5 max-w-xl">
          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              主题
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTheme('dark')}
                style={{
                  borderColor: isCurrentTheme('dark', theme) ? 'var(--color-primary)' : undefined,
                }}
              >
                暗色
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTheme('light')}
                style={{
                  borderColor: isCurrentTheme('light', theme) ? 'var(--color-primary)' : undefined,
                }}
              >
                亮色
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              全局刷新间隔
            </label>
            <select
              className="select"
              value={refreshInterval}
              onChange={(event) => setRefreshInterval(Number(event.target.value))}
            >
              <option value={15}>快速（15 秒）</option>
              <option value={30}>标准（30 秒）</option>
              <option value={60}>慢速（60 秒）</option>
            </select>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              全局刷新会影响主要列表和概览请求；部分强实时接口（例如 5 秒/10 秒级）不受此设置影响。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
