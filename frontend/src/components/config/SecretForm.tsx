import { useState } from 'react';
import { XMarkIcon, PlusIcon, KeyIcon } from '@heroicons/react/24/outline';
import KeyValuePairInput from '../common/KeyValuePairInput';
import type { Secret } from '../../types';

interface SecretFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (secret: Secret) => Promise<void>;
  namespace: string;
  isPending?: boolean;
}

interface DataItem {
  key: string;
  value: string;
}

// Secret 类型选项
const SECRET_TYPES = [
  { value: 'Opaque', label: 'Opaque (通用)' },
  { value: 'kubernetes.io/tls', label: 'TLS' },
  { value: 'kubernetes.io/dockerconfigjson', label: 'Docker Registry' },
  { value: 'kubernetes.io/basic-auth', label: 'Basic Auth' },
  { value: 'kubernetes.io/ssh-auth', label: 'SSH Auth' },
  { value: 'kubernetes.io/service-account-token', label: 'Service Account Token' },
];

export default function SecretForm({
  isOpen,
  onClose,
  onSubmit,
  namespace,
  isPending = false,
}: SecretFormProps) {
  const [name, setName] = useState('');
  const [secretType, setSecretType] = useState('Opaque');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [dataItems, setDataItems] = useState<DataItem[]>([{ key: '', value: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 重置表单
  const resetForm = () => {
    setName('');
    setSecretType('Opaque');
    setLabels({});
    setAnnotations({});
    setDataItems([{ key: '', value: '' }]);
    setErrors({});
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 验证名称
    if (!name.trim()) {
      newErrors.name = '名称不能为空';
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
      newErrors.name = '名称只能包含小写字母、数字和连字符，且必须以字母或数字开头和结尾';
    }

    // 验证数据项
    const validDataItems = dataItems.filter(item => item.key.trim() !== '');
    if (validDataItems.length === 0) {
      newErrors.data = '至少需要一个数据项';
    }

    // 检查数据项键名重复
    const keys = validDataItems.map(item => item.key);
    const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
    if (duplicateKeys.length > 0) {
      newErrors.data = `数据键名重复: ${duplicateKeys.join(', ')}`;
    }

    // TLS 类型特殊验证
    if (secretType === 'kubernetes.io/tls') {
      const hasKey = validDataItems.some(item => item.key === 'tls.key');
      const hasCert = validDataItems.some(item => item.key === 'tls.crt');
      if (!hasKey || !hasCert) {
        newErrors.data = 'TLS 类型 Secret 必须包含 tls.key 和 tls.crt';
      }
    }

    // Docker Registry 类型特殊验证
    if (secretType === 'kubernetes.io/dockerconfigjson') {
      const hasDockerConfig = validDataItems.some(item => item.key === '.dockerconfigjson');
      if (!hasDockerConfig) {
        newErrors.data = 'Docker Registry 类型 Secret 必须包含 .dockerconfigjson';
      }
    }

    // Basic Auth 类型特殊验证
    if (secretType === 'kubernetes.io/basic-auth') {
      const hasUsername = validDataItems.some(item => item.key === 'username');
      const hasPassword = validDataItems.some(item => item.key === 'password');
      if (!hasUsername || !hasPassword) {
        newErrors.data = 'Basic Auth 类型 Secret 必须包含 username 和 password';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 添加数据项
  const addDataItem = () => {
    setDataItems([...dataItems, { key: '', value: '' }]);
  };

  // 删除数据项
  const removeDataItem = (index: number) => {
    setDataItems(dataItems.filter((_, i) => i !== index));
  };

  // 更新数据项的键
  const updateDataKey = (index: number, key: string) => {
    const newItems = [...dataItems];
    newItems[index] = { ...newItems[index], key };
    setDataItems(newItems);
  };

  // 更新数据项的值
  const updateDataValue = (index: number, value: string) => {
    const newItems = [...dataItems];
    newItems[index] = { ...newItems[index], value };
    setDataItems(newItems);
  };

  // Secret 类型改变时，自动添加必需的字段
  const handleTypeChange = (type: string) => {
    setSecretType(type);

    // 根据类型预填充必需字段
    if (type === 'kubernetes.io/tls') {
      setDataItems([
        { key: 'tls.crt', value: '' },
        { key: 'tls.key', value: '' },
      ]);
    } else if (type === 'kubernetes.io/dockerconfigjson') {
      setDataItems([{ key: '.dockerconfigjson', value: '' }]);
    } else if (type === 'kubernetes.io/basic-auth') {
      setDataItems([
        { key: 'username', value: '' },
        { key: 'password', value: '' },
      ]);
    } else if (type === 'kubernetes.io/ssh-auth') {
      setDataItems([{ key: 'ssh-privatekey', value: '' }]);
    } else {
      setDataItems([{ key: '', value: '' }]);
    }
  };

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // 构建 Secret 对象（使用 stringData 而不是 data，避免手动 base64 编码）
    const stringData: Record<string, string> = {};
    dataItems
      .filter(item => item.key.trim() !== '')
      .forEach(item => {
        stringData[item.key] = item.value;
      });

    const secret: Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      type: secretType,
      metadata: {
        name,
        namespace,
        labels: Object.keys(labels).length > 0 ? labels : undefined,
        annotations: Object.keys(annotations).length > 0 ? annotations : undefined,
      },
      stringData,
    };

    try {
      await onSubmit(secret);
      resetForm();
      onClose();
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  // 处理关闭
  const handleClose = () => {
    if (name || dataItems.some(item => item.key || item.value)) {
      if (confirm('有未保存的更改，确定要关闭吗？')) {
        resetForm();
        onClose();
      }
    } else {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <KeyIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">创建 Secret</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                在命名空间 <span className="text-purple-400">{namespace}</span> 中创建新的 Secret
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 表单区域 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white">基本信息</h4>

              {/* 名称 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-secret"
                  className={`w-full px-4 py-2.5 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {errors.name && (
                  <p className="text-sm text-red-400 mt-1">{errors.name}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  只能包含小写字母、数字和连字符（-），必须以字母或数字开头和结尾
                </p>
              </div>

              {/* Secret 类型 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Secret 类型 <span className="text-red-400">*</span>
                </label>
                <select
                  value={secretType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {SECRET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  选择 Secret 类型，不同类型有不同的数据字段要求
                </p>
              </div>
            </div>

            {/* 标签 */}
            <div>
              <KeyValuePairInput
                label="标签"
                value={labels}
                onChange={setLabels}
                placeholder={{ key: 'app', value: 'myapp' }}
              />
            </div>

            {/* 注解 */}
            <div>
              <KeyValuePairInput
                label="注解"
                value={annotations}
                onChange={setAnnotations}
                placeholder={{ key: 'description', value: 'My secret' }}
              />
            </div>

            {/* 数据项 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  数据 <span className="text-red-400">*</span>
                </h4>
                {errors.data && (
                  <p className="text-sm text-red-400">{errors.data}</p>
                )}
              </div>

              <div className="space-y-3">
                {dataItems.map((item, index) => (
                  <div key={index} className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">数据项 {index + 1}</span>
                      {dataItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDataItem(index)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          删除
                        </button>
                      )}
                    </div>

                    {/* 键 */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">键名</label>
                      <input
                        type="text"
                        value={item.key}
                        onChange={(e) => updateDataKey(index, e.target.value)}
                        placeholder={
                          secretType === 'kubernetes.io/tls'
                            ? 'tls.crt 或 tls.key'
                            : secretType === 'kubernetes.io/dockerconfigjson'
                            ? '.dockerconfigjson'
                            : 'password'
                        }
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>

                    {/* 值 */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">值</label>
                      <textarea
                        value={item.value}
                        onChange={(e) => updateDataValue(index, e.target.value)}
                        placeholder="敏感数据内容..."
                        rows={4}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm resize-none"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        数据会自动进行 Base64 编码
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {secretType === 'Opaque' && (
                <button
                  type="button"
                  onClick={addDataItem}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>添加数据项</span>
                </button>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-slate-300 hover:text-white transition-colors font-medium"
              disabled={isPending}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>创建中...</span>
                </>
              ) : (
                <span>创建 Secret</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
