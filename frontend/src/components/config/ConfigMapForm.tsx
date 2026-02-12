import { useState } from 'react';
import { XMarkIcon, PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import KeyValuePairInput from '../common/KeyValuePairInput';
import type { ConfigMapInput } from '../../types';

interface ConfigMapFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (configMap: ConfigMapInput) => Promise<void>;
  namespace: string;
  isPending?: boolean;
}

interface DataItem {
  key: string;
  value: string;
}

export default function ConfigMapForm({
  isOpen,
  onClose,
  onSubmit,
  namespace,
  isPending = false,
}: ConfigMapFormProps) {
  const [name, setName] = useState('');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [dataItems, setDataItems] = useState<DataItem[]>([{ key: '', value: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 重置表单
  const resetForm = () => {
    setName('');
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

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // 构建 ConfigMap 对象
    const data: Record<string, string> = {};
    dataItems
      .filter(item => item.key.trim() !== '')
      .forEach(item => {
        data[item.key] = item.value;
      });

    const configMap: ConfigMapInput = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name,
        namespace,
        labels: Object.keys(labels).length > 0 ? labels : undefined,
        annotations: Object.keys(annotations).length > 0 ? annotations : undefined,
      },
      data,
    };

    try {
      await onSubmit(configMap);
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
      <div className="bg-surface-secondary rounded-xl border border-border w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <DocumentTextIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">创建 ConfigMap</h3>
              <p className="text-sm text-text-muted mt-0.5">
                在命名空间 <span className="text-blue-400">{namespace}</span> 中创建新的 ConfigMap
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-text-muted hover:text-white transition-colors"
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
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-config"
                  className={`w-full px-4 py-2.5 bg-surface-tertiary border rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-border-hover'
                  }`}
                />
                {errors.name && (
                  <p className="text-sm text-red-400 mt-1">{errors.name}</p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  只能包含小写字母、数字和连字符（-），必须以字母或数字开头和结尾
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
                placeholder={{ key: 'description', value: 'My configuration' }}
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
                  <div key={index} className="bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted">数据项 {index + 1}</span>
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
                      <label className="block text-xs text-text-muted mb-1">键名</label>
                      <input
                        type="text"
                        value={item.key}
                        onChange={(e) => updateDataKey(index, e.target.value)}
                        placeholder="config.yaml"
                        className="w-full px-4 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>

                    {/* 值 */}
                    <div>
                      <label className="block text-xs text-text-muted mb-1">值</label>
                      <textarea
                        value={item.value}
                        onChange={(e) => updateDataValue(index, e.target.value)}
                        placeholder="配置内容..."
                        rows={4}
                        className="w-full px-4 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addDataItem}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>添加数据项</span>
              </button>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-[color-mix(in_srgb,var(--color-bg-secondary)_50%,transparent)]">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-text-secondary hover:text-white transition-colors font-medium"
              disabled={isPending}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>创建中...</span>
                </>
              ) : (
                <span>创建 ConfigMap</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
