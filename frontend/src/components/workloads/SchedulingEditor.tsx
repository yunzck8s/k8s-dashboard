import { useState } from 'react';
import { PlusIcon, ServerIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
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

function normalizeNodeSelector(selector: NodeSelector): Array<{ key: string; value: string }> {
  return Object.entries(selector).map(([key, value]) => ({ key, value }));
}

function normalizeTolerations(tolerations: Toleration[]): Toleration[] {
  return tolerations.map((toleration) => ({ ...toleration }));
}

function SchedulingEditorContent({
  onClose,
  onSave,
  nodeSelector = {},
  tolerations = [],
  isPending = false,
}: Omit<SchedulingEditorProps, 'isOpen'>) {
  const [activeTab, setActiveTab] = useState<'nodeSelector' | 'tolerations'>('nodeSelector');
  const [editedNodeSelector, setEditedNodeSelector] = useState<Array<{ key: string; value: string }>>(() =>
    normalizeNodeSelector(nodeSelector)
  );
  const [editedTolerations, setEditedTolerations] = useState<Toleration[]>(() =>
    normalizeTolerations(tolerations)
  );

  const addNodeSelector = () => {
    setEditedNodeSelector((previous) => [...previous, { key: '', value: '' }]);
  };

  const removeNodeSelector = (index: number) => {
    setEditedNodeSelector((previous) => previous.filter((_, selectorIndex) => selectorIndex !== index));
  };

  const updateNodeSelector = (index: number, field: 'key' | 'value', value: string) => {
    setEditedNodeSelector((previous) => {
      const updated = [...previous];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addToleration = () => {
    setEditedTolerations((previous) => [
      ...previous,
      { key: '', operator: 'Equal', value: '', effect: 'NoSchedule' },
    ]);
  };

  const removeToleration = (index: number) => {
    setEditedTolerations((previous) => previous.filter((_, tolerationIndex) => tolerationIndex !== index));
  };

  const updateToleration = (index: number, field: keyof Toleration, value: string | number) => {
    setEditedTolerations((previous) => {
      const updated = [...previous];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextNodeSelector: NodeSelector = {};
    editedNodeSelector.forEach(({ key, value }) => {
      if (!key.trim()) {
        return;
      }
      nextNodeSelector[key.trim()] = value.trim();
    });

    const cleanedTolerations = editedTolerations
      .filter((toleration) => toleration.key || toleration.operator === 'Exists')
      .map((toleration) => {
        const cleaned: Toleration = {};
        if (toleration.key) cleaned.key = toleration.key;
        if (toleration.operator) cleaned.operator = toleration.operator;
        if (toleration.operator !== 'Exists' && toleration.value) cleaned.value = toleration.value;
        if (toleration.effect) cleaned.effect = toleration.effect;
        if (toleration.tolerationSeconds !== undefined) {
          cleaned.tolerationSeconds = toleration.tolerationSeconds;
        }
        return cleaned;
      });

    onSave({
      nodeSelector: Object.keys(nextNodeSelector).length > 0 ? nextNodeSelector : undefined,
      tolerations: cleanedTolerations.length > 0 ? cleanedTolerations : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-secondary rounded-xl border border-border w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <ServerIcon className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">调度配置</h3>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-border px-6">
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
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 min-h-[300px] max-h-96 overflow-y-auto">
            {activeTab === 'nodeSelector' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-muted">指定 Pod 只能调度到带有特定标签的节点上</p>
                  <button
                    type="button"
                    onClick={addNodeSelector}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    添加
                  </button>
                </div>

                {editedNodeSelector.length === 0 ? (
                  <div className="text-center py-8 text-text-muted">暂无节点选择器配置</div>
                ) : (
                  <div className="space-y-3">
                    {editedNodeSelector.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(event) => updateNodeSelector(index, 'key', event.target.value)}
                          placeholder="标签键"
                          className="flex-1 px-3 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-text-muted">=</span>
                        <input
                          type="text"
                          value={item.value}
                          onChange={(event) => updateNodeSelector(index, 'value', event.target.value)}
                          placeholder="标签值"
                          className="flex-1 px-3 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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

                <div className="mt-4 p-3 bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)] rounded-lg">
                  <p className="text-xs text-text-muted">
                    常用标签: <code className="text-text-muted">kubernetes.io/hostname</code>,
                    <code className="text-text-muted ml-1">node.kubernetes.io/instance-type</code>,
                    <code className="text-text-muted ml-1">topology.kubernetes.io/zone</code>
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'tolerations' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-muted">允许 Pod 调度到带有特定污点的节点上</p>
                  <button
                    type="button"
                    onClick={addToleration}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    添加
                  </button>
                </div>

                {editedTolerations.length === 0 ? (
                  <div className="text-center py-8 text-text-muted">暂无容忍度配置</div>
                ) : (
                  <div className="space-y-3">
                    {editedTolerations.map((toleration, index) => (
                      <div key={index} className="p-3 bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)] rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-muted">容忍度 #{index + 1}</span>
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
                            <label className="block text-xs text-text-muted mb-1">Key</label>
                            <input
                              type="text"
                              value={toleration.key || ''}
                              onChange={(event) => updateToleration(index, 'key', event.target.value)}
                              placeholder="例: node.kubernetes.io/not-ready"
                              className="w-full px-3 py-2 bg-surface-secondary border border-border-hover rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-text-muted mb-1">Operator</label>
                            <select
                              value={toleration.operator || 'Equal'}
                              onChange={(event) => updateToleration(index, 'operator', event.target.value)}
                              className="w-full px-3 py-2 bg-surface-secondary border border-border-hover rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="Equal">Equal</option>
                              <option value="Exists">Exists</option>
                            </select>
                          </div>
                          {toleration.operator !== 'Exists' && (
                            <div>
                              <label className="block text-xs text-text-muted mb-1">Value</label>
                              <input
                                type="text"
                                value={toleration.value || ''}
                                onChange={(event) => updateToleration(index, 'value', event.target.value)}
                                className="w-full px-3 py-2 bg-surface-secondary border border-border-hover rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-xs text-text-muted mb-1">Effect</label>
                            <select
                              value={toleration.effect || ''}
                              onChange={(event) => updateToleration(index, 'effect', event.target.value)}
                              className="w-full px-3 py-2 bg-surface-secondary border border-border-hover rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-[color-mix(in_srgb,var(--color-bg-secondary)_50%,transparent)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
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

export default function SchedulingEditor(props: SchedulingEditorProps) {
  if (!props.isOpen) {
    return null;
  }

  const modalKey = `${JSON.stringify(props.nodeSelector ?? {})}:${JSON.stringify(props.tolerations ?? [])}`;

  return (
    <SchedulingEditorContent
      key={modalKey}
      onClose={props.onClose}
      onSave={props.onSave}
      nodeSelector={props.nodeSelector}
      tolerations={props.tolerations}
      isPending={props.isPending}
    />
  );
}
