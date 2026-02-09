import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

// 普通操作项
interface ActionItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

// 分隔线
interface DividerItem {
  divider: true;
}

// 联合类型
type DropdownItem = ActionItem | DividerItem;

// 类型守卫
function isDivider(item: DropdownItem): item is DividerItem {
  return 'divider' in item && item.divider === true;
}

interface ActionDropdownProps {
  label?: string;
  items: DropdownItem[];
  buttonClassName?: string;
  disabled?: boolean;
  trigger?: ReactNode;
}

export default function ActionDropdown({
  label = '操作',
  items,
  buttonClassName,
  disabled = false,
  trigger,
}: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)}>
          {trigger}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            buttonClassName
          )}
          style={{
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          {label}
          <ChevronDownIcon className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      )}

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-lg shadow-xl z-50 overflow-hidden"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="py-1">
            {items.map((item, index) => (
              <div key={index}>
                {isDivider(item) ? (
                  <div className="my-1" style={{ borderTop: '1px solid var(--color-border)' }} />
                ) : (
                  <button
                    onClick={() => {
                      if (!item.disabled) {
                        item.onClick();
                        setIsOpen(false);
                      }
                    }}
                    disabled={item.disabled}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-150',
                      item.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    style={{
                      color: item.danger ? '#F87171' : 'var(--color-text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = item.danger
                        ? 'rgba(248, 113, 113, 0.1)'
                        : 'var(--color-bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
                    {item.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
