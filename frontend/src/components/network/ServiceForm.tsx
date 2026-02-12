import { useState } from 'react';
import { XMarkIcon, PlusIcon, GlobeAltIcon, TrashIcon } from '@heroicons/react/24/outline';
import KeyValuePairInput from '../common/KeyValuePairInput';
import type { ServiceInput, ServiceType } from '../../types';

interface ServiceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (service: ServiceInput) => Promise<void>;
  namespace: string;
  isPending?: boolean;
}

interface PortMapping {
  name: string;
  protocol: string;
  port: number;
  targetPort: number | string;
  nodePort?: number;
}

// Service 类型选项
const SERVICE_TYPES: Array<{ value: ServiceType; label: string; description: string }> = [
  { value: 'ClusterIP', label: 'ClusterIP', description: '集群内部访问' },
  { value: 'NodePort', label: 'NodePort', description: '通过节点端口访问' },
  { value: 'LoadBalancer', label: 'LoadBalancer', description: '通过负载均衡器访问' },
];

export default function ServiceForm({
  isOpen,
  onClose,
  onSubmit,
  namespace,
  isPending = false,
}: ServiceFormProps) {
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('ClusterIP');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [selector, setSelector] = useState<Record<string, string>>({});
  const [ports, setPorts] = useState<PortMapping[]>([
    { name: 'http', protocol: 'TCP', port: 80, targetPort: 8080 },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 重置表单
  const resetForm = () => {
    setName('');
    setServiceType('ClusterIP');
    setLabels({});
    setSelector({});
    setPorts([{ name: 'http', protocol: 'TCP', port: 80, targetPort: 8080 }]);
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

    // 验证 Selector
    if (Object.keys(selector).length === 0) {
      newErrors.selector = '至少需要一个选择器标签';
    }

    // 验证端口映射
    if (ports.length === 0) {
      newErrors.ports = '至少需要一个端口映射';
    } else {
      const validPorts = ports.filter(p => p.port > 0);
      if (validPorts.length === 0) {
        newErrors.ports = '至少需要一个有效的端口映射';
      }

      // 检查端口重复
      const portNumbers = validPorts.map(p => p.port);
      const duplicates = portNumbers.filter((port, index) => portNumbers.indexOf(port) !== index);
      if (duplicates.length > 0) {
        newErrors.ports = `端口重复: ${duplicates.join(', ')}`;
      }

      // 检查 NodePort 范围（30000-32767）
      if (serviceType === 'NodePort') {
        const invalidNodePorts = validPorts.filter(p => p.nodePort && (p.nodePort < 30000 || p.nodePort > 32767));
        if (invalidNodePorts.length > 0) {
          newErrors.ports = 'NodePort 必须在 30000-32767 范围内';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 添加端口映射
  const addPort = () => {
    setPorts([...ports, { name: '', protocol: 'TCP', port: 80, targetPort: 8080 }]);
  };

  // 删除端口映射
  const removePort = (index: number) => {
    setPorts(ports.filter((_, i) => i !== index));
  };

  // 更新端口映射
  const updatePort = (index: number, field: keyof PortMapping, value: string | number | undefined) => {
    setPorts((previous) =>
      previous.map((port, portIndex) =>
        portIndex === index ? ({ ...port, [field]: value } as PortMapping) : port
      )
    );
  };

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // 构建 Service 对象
    const service: ServiceInput = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name,
        namespace,
        labels: Object.keys(labels).length > 0 ? labels : undefined,
      },
      spec: {
        type: serviceType,
        selector,
        ports: ports
          .filter(p => p.port > 0)
          .map(p => ({
            name: p.name || undefined,
            protocol: p.protocol,
            port: p.port,
            targetPort: p.targetPort,
            nodePort: serviceType === 'NodePort' || serviceType === 'LoadBalancer' ? p.nodePort : undefined,
          })),
      },
    };

    try {
      await onSubmit(service);
      resetForm();
      onClose();
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  // 处理关闭
  const handleClose = () => {
    if (name || Object.keys(selector).length > 0) {
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
      <div className="bg-surface-secondary rounded-xl border border-border w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <GlobeAltIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">创建 Service</h3>
              <p className="text-sm text-text-muted mt-0.5">
                在命名空间 <span className="text-blue-400">{namespace}</span> 中创建新的 Service
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
                  placeholder="my-service"
                  className={`w-full px-4 py-2.5 bg-surface-tertiary border rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-border-hover'
                  }`}
                />
                {errors.name && <p className="text-sm text-red-400 mt-1">{errors.name}</p>}
              </div>

              {/* Service 类型 */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Service 类型 <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {SERVICE_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setServiceType(type.value)}
                      className={`p-4 rounded-lg border-2 transition-colors text-left ${
                        serviceType === type.value
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-border hover:border-border-hover bg-surface-tertiary'
                      }`}
                    >
                      <div className="font-medium text-white mb-1">{type.label}</div>
                      <div className="text-xs text-text-muted">{type.description}</div>
                    </button>
                  ))}
                </div>
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

            {/* 选择器 */}
            <div>
              <KeyValuePairInput
                label="选择器 (Selector)"
                value={selector}
                onChange={setSelector}
                placeholder={{ key: 'app', value: 'myapp' }}
                required
              />
              {errors.selector && <p className="text-sm text-red-400 mt-1">{errors.selector}</p>}
              <p className="text-xs text-text-muted mt-1">
                选择器用于匹配目标 Pod，必须与 Pod 的标签匹配
              </p>
            </div>

            {/* 端口映射 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  端口映射 <span className="text-red-400">*</span>
                </h4>
                {errors.ports && <p className="text-sm text-red-400">{errors.ports}</p>}
              </div>

              <div className="space-y-3">
                {ports.map((port, index) => (
                  <div key={index} className="bg-[color-mix(in_srgb,var(--color-bg-tertiary)_50%,transparent)] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-muted">端口 {index + 1}</span>
                      {ports.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePort(index)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                        >
                          <TrashIcon className="w-4 h-4" />
                          删除
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Port 名称 */}
                      <div>
                        <label className="block text-xs text-text-muted mb-1">名称（可选）</label>
                        <input
                          type="text"
                          value={port.name}
                          onChange={(e) => updatePort(index, 'name', e.target.value)}
                          placeholder="http"
                          className="w-full px-3 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>

                      {/* 协议 */}
                      <div>
                        <label className="block text-xs text-text-muted mb-1">协议</label>
                        <select
                          value={port.protocol}
                          onChange={(e) => updatePort(index, 'protocol', e.target.value)}
                          className="w-full px-3 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="TCP">TCP</option>
                          <option value="UDP">UDP</option>
                          <option value="SCTP">SCTP</option>
                        </select>
                      </div>

                      {/* Port */}
                      <div>
                        <label className="block text-xs text-text-muted mb-1">
                          Service 端口 <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          value={port.port || ''}
                          onChange={(e) => updatePort(index, 'port', parseInt(e.target.value) || 0)}
                          placeholder="80"
                          min="1"
                          max="65535"
                          className="w-full px-3 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>

                      {/* Target Port */}
                      <div>
                        <label className="block text-xs text-text-muted mb-1">
                          目标端口 <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={port.targetPort}
                          onChange={(e) => {
                            const val = e.target.value;
                            updatePort(index, 'targetPort', isNaN(Number(val)) ? val : parseInt(val));
                          }}
                          placeholder="8080"
                          className="w-full px-3 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    {/* NodePort */}
                    {(serviceType === 'NodePort' || serviceType === 'LoadBalancer') && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-text-muted mb-1">
                            NodePort（可选，30000-32767）
                          </label>
                          <input
                            type="number"
                            value={port.nodePort || ''}
                            onChange={(e) => {
                              const value = e.target.value.trim();
                              updatePort(index, 'nodePort', value === '' ? undefined : parseInt(value, 10));
                            }}
                            placeholder="自动分配"
                            min="30000"
                            max="32767"
                            className="w-full px-3 py-2 bg-surface-tertiary border border-border-hover rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addPort}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>添加端口映射</span>
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
                <span>创建 Service</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
