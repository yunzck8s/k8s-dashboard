import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface KeyValuePair {
  key: string;
  value: string;
}

interface KeyValuePairInputProps {
  label: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  placeholder?: { key: string; value: string };
  disabled?: boolean;
  required?: boolean;
}

export default function KeyValuePairInput({
  label,
  value,
  onChange,
  placeholder = { key: 'key', value: 'value' },
  disabled = false,
  required = false,
}: KeyValuePairInputProps) {
  // 将对象转换为数组以便编辑
  const pairs: KeyValuePair[] = Object.entries(value || {}).map(([key, val]) => ({
    key,
    value: val,
  }));

  // 添加新的键值对
  const handleAdd = () => {
    const newPairs = [...pairs, { key: '', value: '' }];
    updateValue(newPairs);
  };

  // 删除键值对
  const handleRemove = (index: number) => {
    const newPairs = pairs.filter((_, i) => i !== index);
    updateValue(newPairs);
  };

  // 更新键
  const handleKeyChange = (index: number, newKey: string) => {
    const newPairs = [...pairs];
    newPairs[index] = { ...newPairs[index], key: newKey };
    updateValue(newPairs);
  };

  // 更新值
  const handleValueChange = (index: number, newValue: string) => {
    const newPairs = [...pairs];
    newPairs[index] = { ...newPairs[index], value: newValue };
    updateValue(newPairs);
  };

  // 将数组转换回对象并触发 onChange
  const updateValue = (newPairs: KeyValuePair[]) => {
    const newValue: Record<string, string> = {};
    newPairs
      .filter((pair) => pair.key.trim() !== '') // 忽略空键
      .forEach((pair) => {
        newValue[pair.key] = pair.value;
      });
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {pairs.length === 0 ? (
        <div className="text-sm text-text-muted italic py-2">
          暂无{label}，点击下方按钮添加
        </div>
      ) : (
        <div className="space-y-2">
          {pairs.map((pair, index) => (
            <div key={index} className="flex gap-2">
              {/* Key 输入框 */}
              <input
                type="text"
                value={pair.key}
                onChange={(e) => handleKeyChange(index, e.target.value)}
                placeholder={placeholder.key}
                disabled={disabled}
                className="flex-1 px-4 py-2.5 bg-surface-tertiary border border-border-hover rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              />

              {/* 分隔符 */}
              <div className="flex items-center px-2 text-text-muted font-bold">
                :
              </div>

              {/* Value 输入框 */}
              <input
                type="text"
                value={pair.value}
                onChange={(e) => handleValueChange(index, e.target.value)}
                placeholder={placeholder.value}
                disabled={disabled}
                className="flex-1 px-4 py-2.5 bg-surface-tertiary border border-border-hover rounded-lg text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              />

              {/* 删除按钮 */}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="删除"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 添加按钮 */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlusIcon className="w-4 h-4" />
        <span>添加{label}</span>
      </button>

      {/* 帮助文本 */}
      {!disabled && pairs.length === 0 && (
        <p className="text-xs text-text-muted mt-1">
          提示：键名遵循 Kubernetes 标签规范（字母数字、-、_、.）
        </p>
      )}
    </div>
  );
}
