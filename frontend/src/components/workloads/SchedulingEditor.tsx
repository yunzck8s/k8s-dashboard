import { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon, ServerIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface NodeSelector {
  [key: string]: string;
}

interface Toleration {
  key?: string;
  operator?: string;
  value?: string;
  effect?: string;
  tolerationSeconds?: number;
}

interface SchedulingEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { nodeSelector?: NodeSelector; tolerations?: Toleration[] }) => void;
  nodeSelector?: NodeSelector;
  tolerations?: Toleration[];
  isPending?: boolean;
}

export default function SchedulingEditor({
  isOpen,
  onClose,
  onSave,
  nodeSelector = {},
  tolerations = [],
  isPending = false,
}: SchedulingEditorProps) {
  const [activeTab, setActiveTab] = useState<'nodeSelector' | 'tolerations'>('nodeSelector');
  const [editedNodeSelector, setEditedNodeSelector] = useState<{ key: string; value: string }[]>([]);
  const [editedTolerations, setEditedTolerations] = useState<Toleration[]>([]);

  useEffect(() => {
    if (isOpen) {
      // 转换 nodeSelector 对象为数组形式便于编辑
      setEditedNodeSelector(
        Object.entries(nodeSelector || {}).map(([key, value]) => ({ key, value }))
      );
      setEditedTolerations((tolerations || []).map(t => ({ ...t })));
    }
  }, [isOpen]); // 只依赖 isOpen，避免无限循环

  // 节点选择器操作
  const addNodeSelector = () => {
    setEditedNodeSelector([...editedNodeSelector, { key: '', value: '' }]);
  };

  const removeNodeSelector = (index: number) => {
    setEditedNodeSelector(editedNodeSelector.filter((_, i) => i !== index));
  };

  const updateNodeSelector = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...editedNodeSelector];
    updated[index] = { ...updated[index], [field]: value };
    setEditedNodeSelector(updated);
  };

  // 容忍度操作
  const addToleration = () => {
    setEditedTolerations([
      ...editedTolerations,
      { key: '', operator: 'Equal', value: '', effect: 'NoSchedule' },
    ]);
  };

  const removeToleration = (index: number) => {
    setEditedTolerations(editedTolerations.filter((_, i) => i !== index));
  };

  const updateToleration = (index: number, field: keyof Toleration, value: string | number) => {
    const updated = [...editedTolerations];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTolerations(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 转换回对象格式
    const newNodeSelector: NodeSelector = {};
    editedNodeSelector.forEach(({ key, value }) => {
      if (key.trim()) {
        newNodeSelector[key.trim()] = value.trim();
      }
    });

    // 清理 tolerations，移除空值字段
    const cleanedTolerations = editedTolerations
      .filter(t => t.key || t.operator === 'Exists')
      .map(t => {
        const cleaned: Toleration = {};
        if (t.key) cleaned.key = t.key;
        if (t.operator) cleaned.operator = t.operator;
        if (t.operator !== 'Exists' && t.value) cleaned.value = t.value;
        if (t.effect) cleaned.effect = t.effect;
        if (t.tolerationSeconds !== undefined) cleaned.tolerationSeconds = t.tolerationSeconds;
        return cleaned;
      });

    onSave({
      nodeSelector: Object.keys(newNodeSelector).length > 0 ? newNodeSelector : undefined,
      tolerations: cleanedTolerations.length > 0 ? cleanedTolerations : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl">
        {/* 标题 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <ServerIcon className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">调度配置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="border-b border-slate-700 px-6">
          <nav className="flex gap-4">
            {[
              { id: 'nodeSelector' as const, label: '节点选择器' },
              { id: 'tolerations' as const, label: '容忍度' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 内容 */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 min-h-[300px] max-h-96 overflow-y-auto">
            {activeTab === 'nodeSelector' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    指定 Pod 只能调度到带有特定标签的节点上
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Adding node selector');
                      addNodeSelector();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    添加
                  </button>
                </div>

                {editedNodeSelector.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    暂无节点选择器配置
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editedNodeSelector.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => updateNodeSelector(index, 'key', e.target.value)}
                          placeholder="标签键"
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-slate-500">=</span>
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => updateNodeSelector(index, 'value', e.target.value)}
                          placeholder="标签值"
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeNodeSelector(index)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-xs text-slate-500">
                    常用标签: <code className="text-slate-400">kubernetes.io/hostname</code>,
                    <code className="text-slate-400 ml-1">node.kubernetes.io/instance-type</code>,
                    <code className="text-slate-400 ml-1">topology.kubernetes.io/zone</code>
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'tolerations' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    允许 Pod 调度到带有特定污点的节点上
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Adding toleration');
                      addToleration();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    添加
                  </button>
                </div>

                {editedTolerations.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    暂无容忍度配置
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editedTolerations.map((toleration, index) => (
                      <div key={index} className="p-3 bg-slate-900/50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">容忍度 #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeToleration(index)}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Key</label>
                            <input
                              type="text"
                              value={toleration.key || ''}
                              onChange={(e) => updateToleration(index, 'key', e.target.value)}
                              placeholder="例: node.kubernetes.io/not-ready"
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Operator</label>
                            <select
                              value={toleration.operator || 'Equal'}
                              onChange={(e) => updateToleration(index, 'operator', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="Equal">Equal</option>
                              <option value="Exists">Exists</option>
                            </select>
                          </div>
                          {toleration.operator !== 'Exists' && (
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Value</label>
                              <input
                                type="text"
                                value={toleration.value || ''}
                                onChange={(e) => updateToleration(index, 'value', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Effect</label>
                            <select
                              value={toleration.effect || ''}
                              onChange={(e) => updateToleration(index, 'effect', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">All</option>
                              <option value="NoSchedule">NoSchedule</option>
                              <option value="PreferNoSchedule">PreferNoSchedule</option>
                              <option value="NoExecute">NoExecute</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
