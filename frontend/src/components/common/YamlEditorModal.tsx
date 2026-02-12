import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import * as yaml from 'js-yaml';
import {
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface YamlEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (yamlContent: string) => Promise<void>;
  initialYaml: string;
  resourceType?: string;
  title?: string;
  isPending?: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function parseYaml(content: string): { isValid: boolean; error: string | null } {
  if (!content || content.trim() === '') {
    return { isValid: false, error: 'YAML 内容不能为空' };
  }

  try {
    yaml.load(content);
    return { isValid: true, error: null };
  } catch (error: unknown) {
    return { isValid: false, error: getErrorMessage(error, 'YAML 语法错误') };
  }
}

function YamlEditorModalContent({
  onClose,
  onSave,
  initialYaml,
  resourceType = 'Resource',
  title,
  isPending = false,
}: Omit<YamlEditorModalProps, 'isOpen'>) {
  const initialState = parseYaml(initialYaml);
  const [yamlContent, setYamlContent] = useState(initialYaml);
  const [error, setError] = useState<string | null>(initialState.error);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(initialState.isValid);
  const validateTimerRef = useRef<number | null>(null);

  const validateYaml = useCallback((content: string): boolean => {
    const result = parseYaml(content);
    setError(result.error);
    setIsValid(result.isValid);
    return result.isValid;
  }, []);

  useEffect(() => {
    return () => {
      if (validateTimerRef.current !== null) {
        window.clearTimeout(validateTimerRef.current);
      }
    };
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value ?? '';
    setYamlContent(newContent);

    if (validateTimerRef.current !== null) {
      window.clearTimeout(validateTimerRef.current);
    }

    setIsValidating(true);
    validateTimerRef.current = window.setTimeout(() => {
      validateYaml(newContent);
      setIsValidating(false);
    }, 300);
  };

  const handleSave = async () => {
    if (!validateYaml(yamlContent)) {
      return;
    }

    try {
      await onSave(yamlContent);
      onClose();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, '保存失败'));
    }
  };

  const handleClose = () => {
    if (yamlContent !== initialYaml) {
      if (window.confirm('有未保存的更改，确定要关闭吗？')) {
        onClose();
      }
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
              <DocumentTextIcon className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {title || `编辑 ${resourceType} YAML`}
              </h3>
              <p className="text-sm mt-0.5 text-[var(--color-text-secondary)]">
                修改 YAML 配置并保存到 Kubernetes 集群
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 transition-colors duration-150"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="关闭 YAML 编辑器"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="h-[500px] flex items-center justify-center text-[var(--color-text-muted)]">
                <div
                  className="animate-spin rounded-full h-6 w-6 border-b-2"
                  style={{ borderColor: 'var(--color-primary)' }}
                />
              </div>
            }
          >
            <MonacoEditor
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
          </Suspense>
        </div>

        <div
          className="px-6 py-3"
          style={{
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-tertiary)',
          }}
        >
          {isValidating ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
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
                <p className="text-xs mt-1" style={{ color: 'rgba(248, 113, 113, 0.8)' }}>
                  {error}
                </p>
              </div>
            </div>
          ) : isValid ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#34D399' }}>
              <CheckCircleIcon className="w-5 h-5" />
              <span>YAML 语法正确</span>
            </div>
          ) : null}
        </div>

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

export default function YamlEditorModal(props: YamlEditorModalProps) {
  if (!props.isOpen) {
    return null;
  }

  const modalKey = `${props.resourceType ?? 'resource'}:${props.initialYaml.length}:${props.initialYaml.slice(0, 64)}`;

  return (
    <YamlEditorModalContent
      key={modalKey}
      onClose={props.onClose}
      onSave={props.onSave}
      initialYaml={props.initialYaml}
      resourceType={props.resourceType}
      title={props.title}
      isPending={props.isPending}
    />
  );
}
