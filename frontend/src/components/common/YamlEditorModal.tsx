import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as yaml from 'js-yaml';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface YamlEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (yamlContent: string) => Promise<void>;
  initialYaml: string;
  resourceType?: string;
  title?: string;
  isPending?: boolean;
}

export default function YamlEditorModal({
  isOpen,
  onClose,
  onSave,
  initialYaml,
  resourceType = 'Resource',
  title,
  isPending = false,
}: YamlEditorModalProps) {
  const [yamlContent, setYamlContent] = useState(initialYaml);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(true);

  // 当模态框打开或 initialYaml 变化时，重置编辑器内容
  useEffect(() => {
    if (isOpen) {
      setYamlContent(initialYaml);
      setError(null);
      validateYaml(initialYaml);
    }
  }, [isOpen, initialYaml]);

  // YAML 语法验证
  const validateYaml = (content: string) => {
    if (!content || content.trim() === '') {
      setError('YAML 内容不能为空');
      setIsValid(false);
      return false;
    }

    try {
      yaml.load(content);
      setError(null);
      setIsValid(true);
      return true;
    } catch (e: any) {
      const errorMessage = e.message || 'YAML 语法错误';
      setError(errorMessage);
      setIsValid(false);
      return false;
    }
  };

  // 处理编辑器内容变化
  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setYamlContent(newContent);

    // 延迟验证以避免频繁验证
    setIsValidating(true);
    const timeoutId = setTimeout(() => {
      validateYaml(newContent);
      setIsValidating(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // 处理保存
  const handleSave = async () => {
    if (!validateYaml(yamlContent)) {
      return;
    }

    try {
      await onSave(yamlContent);
      onClose();
    } catch (error: any) {
      setError(error.message || '保存失败');
    }
  };

  // 处理取消
  const handleClose = () => {
    if (yamlContent !== initialYaml) {
      if (confirm('有未保存的更改，确定要关闭吗？')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ background: 'var(--color-primary-light)' }}
            >
              <DocumentTextIcon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {title || `编辑 ${resourceType} YAML`}
              </h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                修改 YAML 配置并保存到 Kubernetes 集群
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 transition-colors duration-150"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 编辑器区域 */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="500px"
            language="yaml"
            theme="vs-dark"
            value={yamlContent}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              formatOnPaste: true,
              formatOnType: true,
            }}
          />
        </div>

        {/* 状态栏 */}
        <div
          className="px-6 py-3"
          style={{
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-tertiary)',
          }}
        >
          {isValidating ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <div
                className="animate-spin rounded-full h-4 w-4 border-b-2"
                style={{ borderColor: 'var(--color-primary)' }}
              />
              <span>正在验证...</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-sm" style={{ color: '#F87171' }}>
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">YAML 语法错误</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(248, 113, 113, 0.8)' }}>{error}</p>
              </div>
            </div>
          ) : isValid ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#34D399' }}>
              <CheckCircleIcon className="w-5 h-5" />
              <span>YAML 语法正确</span>
            </div>
          ) : null}
        </div>

        {/* 底部按钮 */}
        <div
          className="flex justify-end gap-3 px-6 py-4"
          style={{
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-tertiary)',
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 font-medium transition-colors duration-150"
            style={{ color: 'var(--color-text-secondary)' }}
            disabled={isPending}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || isPending || isValidating}
            className="px-6 py-2.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              background: 'var(--color-primary)',
              color: 'white',
            }}
          >
            {isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>保存中...</span>
              </>
            ) : (
              <span>保存更改</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
