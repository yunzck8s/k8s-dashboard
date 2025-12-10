import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, type CreateUserRequest, type UpdateUserRequest } from '../../api/auth';
import { namespaceApi } from '../../api';
import { useAuthStore, type User } from '../../store/auth';
import { useNotificationStore } from '../../store';
import clsx from 'clsx';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

// 角色选项
const roleOptions = [
  { value: 'admin', label: '管理员', description: '拥有所有权限' },
  { value: 'operator', label: '操作员', description: '可执行大部分操作，危险操作需审批' },
  { value: 'viewer', label: '只读用户', description: '只能查看资源' },
];

// 用户表单 Modal
function UserFormModal({
  user,
  onClose,
  onSave,
}: {
  user?: User;
  onClose: () => void;
  onSave: (data: CreateUserRequest | UpdateUserRequest) => Promise<void>;
}) {
  const [formData, setFormData] = useState<{
    username: string;
    password: string;
    displayName: string;
    email: string;
    role: string;
    enabled: boolean;
    allNamespaces: boolean;
    namespaces: string[];
  }>({
    username: user?.username || '',
    password: '',
    displayName: user?.displayName || '',
    email: user?.email || '',
    role: user?.role || 'viewer',
    enabled: user?.enabled ?? true,
    allNamespaces: user?.allNamespaces ?? false,
    namespaces: [],
  });
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 获取命名空间列表
  const { data: nsData } = useQuery({
    queryKey: ['namespaces'],
    queryFn: () => namespaceApi.list(),
  });

  // 如果是编辑用户，获取用户的命名空间
  const { data: userData } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => userApi.get(user!.id),
    enabled: !!user?.id,
  });

  // 初始化选中的命名空间
  useState(() => {
    if (userData?.namespaces) {
      setSelectedNamespaces(userData.namespaces);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user && !formData.username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!user && formData.password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    setSaving(true);
    try {
      if (user) {
        // 更新用户
        await onSave({
          displayName: formData.displayName,
          email: formData.email,
          role: formData.role,
          enabled: formData.enabled,
          allNamespaces: formData.allNamespaces,
          namespaces: selectedNamespaces,
        });
      } else {
        // 创建用户
        await onSave({
          username: formData.username.trim(),
          password: formData.password,
          displayName: formData.displayName,
          email: formData.email,
          role: formData.role,
          allNamespaces: formData.allNamespaces,
          namespaces: selectedNamespaces,
        });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleNamespace = (ns: string) => {
    setSelectedNamespaces((prev) =>
      prev.includes(ns) ? prev.filter((n) => n !== ns) : [...prev, ns]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {user ? '编辑用户' : '创建用户'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              用户名 {!user && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={!!user}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white disabled:opacity-50"
              placeholder="请输入用户名"
            />
          </div>

          {/* 密码（仅创建时） */}
          {!user && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                密码 <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="至少6位"
              />
            </div>
          )}

          {/* 显示名 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              显示名称
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="用户显示名称"
            />
          </div>

          {/* 邮箱 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              邮箱
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="user@example.com"
            />
          </div>

          {/* 角色 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              角色
            </label>
            <div className="space-y-2">
              {roleOptions.map((role) => (
                <label
                  key={role.value}
                  className={clsx(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    formData.role === role.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 hover:border-slate-500'
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={formData.role === role.value}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-white font-medium">{role.label}</div>
                    <div className="text-slate-400 text-sm">{role.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 命名空间权限 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                命名空间权限
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.allNamespaces}
                  onChange={(e) => setFormData({ ...formData, allNamespaces: e.target.checked })}
                  className="rounded border-slate-600"
                />
                所有命名空间
              </label>
            </div>
            {!formData.allNamespaces && (
              <div className="max-h-40 overflow-y-auto bg-slate-700 rounded-lg p-2">
                {nsData?.items?.map((ns) => (
                  <label
                    key={ns.metadata.name}
                    className="flex items-center gap-2 p-2 hover:bg-slate-600 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedNamespaces.includes(ns.metadata.name)}
                      onChange={() => toggleNamespace(ns.metadata.name)}
                      className="rounded border-slate-500"
                    />
                    <span className="text-slate-200">{ns.metadata.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 启用状态 */}
          {user && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="rounded border-slate-600"
              />
              <span className="text-slate-300">启用用户</span>
            </label>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 重置密码 Modal
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const resetMutation = useMutation({
    mutationFn: (newPassword: string) => userApi.resetPassword(user.id, newPassword),
    onSuccess: () => {
      addNotification({ type: 'success', title: '密码已重置' });
      onClose();
    },
    onError: (err: Error) => {
      addNotification({ type: 'error', title: '重置失败', message: err.message });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      addNotification({ type: 'error', title: '密码长度至少6位' });
      return;
    }
    setSaving(true);
    await resetMutation.mutateAsync(password);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">重置密码</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-slate-300 text-sm">
            重置用户 <span className="text-white font-medium">{user.username}</span> 的密码
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码（至少6位）"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-300">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg"
            >
              {saving ? '重置中...' : '重置'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);

  // 获取用户列表
  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, role: roleFilter }],
    queryFn: () => userApi.list({ search, role: roleFilter }),
  });

  // 创建用户
  const createMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => userApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addNotification({ type: 'success', title: '用户创建成功' });
    },
    onError: (err: Error) => {
      addNotification({ type: 'error', title: '创建失败', message: err.message });
    },
  });

  // 更新用户
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) =>
      userApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addNotification({ type: 'success', title: '用户更新成功' });
    },
    onError: (err: Error) => {
      addNotification({ type: 'error', title: '更新失败', message: err.message });
    },
  });

  // 删除用户
  const deleteMutation = useMutation({
    mutationFn: (id: number) => userApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addNotification({ type: 'success', title: '用户已删除' });
    },
    onError: (err: Error) => {
      addNotification({ type: 'error', title: '删除失败', message: err.message });
    },
  });

  const handleDelete = (user: User) => {
    if (user.id === currentUser?.id) {
      addNotification({ type: 'error', title: '不能删除当前登录用户' });
      return;
    }
    if (confirm(`确定要删除用户 "${user.username}" 吗？`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-400';
      case 'operator':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getRoleLabel = (role: string) => {
    const r = roleOptions.find((o) => o.value === role);
    return r?.label || role;
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">用户管理</h1>
          <p className="text-slate-400 mt-1">管理系统用户和权限</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          <PlusIcon className="w-5 h-5" />
          创建用户
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户名或邮箱..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
        >
          <option value="">所有角色</option>
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* 用户列表 */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">加载中...</div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-slate-400">暂无用户</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">用户</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">角色</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">命名空间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">最后登录</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {data.items.map((user) => (
                <tr key={user.id} className="hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {user.displayName?.[0] || user.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-white font-medium">{user.displayName || user.username}</div>
                        <div className="text-slate-400 text-sm">{user.email || user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-1 rounded text-xs font-medium', getRoleColor(user.role))}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-sm">
                    {user.allNamespaces ? (
                      <span className="text-green-400">所有命名空间</span>
                    ) : (
                      <span>受限</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.enabled ? (
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <CheckIcon className="w-4 h-4" /> 启用
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400 text-sm">
                        <XMarkIcon className="w-4 h-4" /> 禁用
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                        title="编辑"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setResetPasswordUser(user)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                        title="重置密码"
                      >
                        <KeyIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={user.id === currentUser?.id}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="删除"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <UserFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={async (data) => {
            await createMutation.mutateAsync(data as CreateUserRequest);
          }}
        />
      )}

      {editingUser && (
        <UserFormModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={async (data) => {
            await updateMutation.mutateAsync({ id: editingUser.id, data: data as UpdateUserRequest });
          }}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
        />
      )}
    </div>
  );
}
