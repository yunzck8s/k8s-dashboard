import { useState } from 'react';
import { XMarkIcon, PlusIcon, GlobeAltIcon, TrashIcon } from '@heroicons/react/24/outline';
import KeyValuePairInput from '../common/KeyValuePairInput';
import type { IngressInput } from '../../types';

interface IngressFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ingress: IngressInput) => Promise<void>;
  namespace: string;
  isPending?: boolean;
}

interface IngressRule {
  host: string;
  path: string;
  pathType: 'Prefix' | 'Exact' | 'ImplementationSpecific';
  serviceName: string;
  servicePort: number;
}

export default function IngressForm({
  isOpen,
  onClose,
  onSubmit,
  namespace,
  isPending = false,
}: IngressFormProps) {
  const [name, setName] = useState('');
  const [ingressClassName, setIngressClassName] = useState('nginx');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<IngressRule[]>([
    { host: '', path: '/', pathType: 'Prefix', serviceName: '', servicePort: 80 },
  ]);
  const [enableTLS, setEnableTLS] = useState(false);
  const [tlsSecretName, setTlsSecretName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 重置表单
  const resetForm = () => {
    setName('');
    setIngressClassName('nginx');
    setLabels({});
    setRules([{ host: '', path: '/', pathType: 'Prefix', serviceName: '', servicePort: 80 }]);
    setEnableTLS(false);
    setTlsSecretName('');
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

    // 验证规则
    const validRules = rules.filter(r => r.host && r.serviceName);
    if (validRules.length === 0) {
      newErrors.rules = '至少需要一个有效的路由规则（Host 和 Service 不能为空）';
    }

    // 验证 TLS
    if (enableTLS && !tlsSecretName.trim()) {
      newErrors.tls = '启用 TLS 时必须指定 Secret 名称';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 添加规则
  const addRule = () => {
    setRules([
      ...rules,
      { host: '', path: '/', pathType: 'Prefix', serviceName: '', servicePort: 80 },
    ]);
  };

  // 删除规则
  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  // 更新规则
  const updateRule = (index: number, field: keyof IngressRule, value: string | number) => {
    setRules((previous) =>
      previous.map((rule, ruleIndex) =>
        ruleIndex === index ? ({ ...rule, [field]: value } as IngressRule) : rule
      )
    );
  };

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // 构建 Ingress 对象
    const validRules = rules.filter(r => r.host && r.serviceName);

    // 按 host 分组规则
    const rulesByHost = validRules.reduce((acc, rule) => {
      if (!acc[rule.host]) {
        acc[rule.host] = [];
      }
      acc[rule.host].push(rule);
      return acc;
    }, {} as Record<string, IngressRule[]>);

    const ingress: IngressInput = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name,
        namespace,
        labels: Object.keys(labels).length > 0 ? labels : undefined,
      },
      spec: {
        ingressClassName: ingressClassName || undefined,
        rules: Object.entries(rulesByHost).map(([host, hostRules]) => ({
          host,
          http: {
            paths: hostRules.map((rule) => ({
              path: rule.path,
              pathType: rule.pathType,
              backend: {
                service: {
                  name: rule.serviceName,
                  port: {
                    number: rule.servicePort,
                  },
                },
              },
            })),
          },
        })),
        tls: enableTLS
          ? [
              {
                hosts: Array.from(new Set(validRules.map((r) => r.host))),
                secretName: tlsSecretName,
              },
            ]
          : undefined,
      },
    };

    try {
      await onSubmit(ingress);
      resetForm();
      onClose();
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  // 处理关闭
  const handleClose = () => {
    if (name || rules.some(r => r.host || r.serviceName)) {
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
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <GlobeAltIcon className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">创建 Ingress</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                在命名空间 <span className="text-green-400">{namespace}</span> 中创建新的 Ingress
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
                  placeholder="my-ingress"
                  className={`w-full px-4 py-2.5 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {errors.name && <p className="text-sm text-red-400 mt-1">{errors.name}</p>}
              </div>

              {/* Ingress Class */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ingress Class
                </label>
                <input
                  type="text"
                  value={ingressClassName}
                  onChange={(e) => setIngressClassName(e.target.value)}
                  placeholder="nginx"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  通常使用 nginx、traefik 等
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

            {/* 路由规则 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  路由规则 <span className="text-red-400">*</span>
                </h4>
                {errors.rules && <p className="text-sm text-red-400">{errors.rules}</p>}
              </div>

              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <div key={index} className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">规则 {index + 1}</span>
                      {rules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRule(index)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                        >
                          <TrashIcon className="w-4 h-4" />
                          删除
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Host */}
                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">
                          Host (域名) <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={rule.host}
                          onChange={(e) => updateRule(index, 'host', e.target.value)}
                          placeholder="example.com"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                      </div>

                      {/* Path */}
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">路径</label>
                        <input
                          type="text"
                          value={rule.path}
                          onChange={(e) => updateRule(index, 'path', e.target.value)}
                          placeholder="/"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                      </div>

                      {/* Path Type */}
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">路径类型</label>
                        <select
                          value={rule.pathType}
                          onChange={(e) => updateRule(index, 'pathType', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        >
                          <option value="Prefix">Prefix (前缀匹配)</option>
                          <option value="Exact">Exact (精确匹配)</option>
                          <option value="ImplementationSpecific">ImplementationSpecific</option>
                        </select>
                      </div>

                      {/* Service Name */}
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          Service 名称 <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={rule.serviceName}
                          onChange={(e) => updateRule(index, 'serviceName', e.target.value)}
                          placeholder="my-service"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                      </div>

                      {/* Service Port */}
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Service 端口</label>
                        <input
                          type="number"
                          value={rule.servicePort || ''}
                          onChange={(e) => updateRule(index, 'servicePort', parseInt(e.target.value) || 80)}
                          placeholder="80"
                          min="1"
                          max="65535"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addRule}
                className="flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>添加路由规则</span>
              </button>
            </div>

            {/* TLS 配置 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white">TLS 配置（可选）</h4>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableTLS}
                  onChange={(e) => setEnableTLS(e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-900 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-sm text-slate-300">启用 HTTPS (TLS)</span>
              </label>

              {enableTLS && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    TLS Secret 名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={tlsSecretName}
                    onChange={(e) => setTlsSecretName(e.target.value)}
                    placeholder="my-tls-secret"
                    className={`w-full px-4 py-2.5 bg-slate-900 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      errors.tls ? 'border-red-500' : 'border-slate-600'
                    }`}
                  />
                  {errors.tls && <p className="text-sm text-red-400 mt-1">{errors.tls}</p>}
                  <p className="text-xs text-slate-500 mt-1">
                    Secret 必须包含 tls.crt 和 tls.key
                  </p>
                </div>
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
              className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>创建中...</span>
                </>
              ) : (
                <span>创建 Ingress</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
