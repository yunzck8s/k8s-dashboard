import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  // 计算显示的页码范围
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const showPages = 5; // 显示的页码数量

    if (totalPages <= showPages + 2) {
      // 页数较少时，显示全部
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 页数较多时，显示部分
      pages.push(1);

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        end = 4;
      }
      if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
      {/* 左侧：每页显示数量 */}
      <div className="flex items-center gap-4">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          每页显示
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className="px-3 py-1 rounded-lg text-sm font-medium transition-all duration-150"
          style={{
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          显示 <span style={{ color: 'var(--color-primary)' }}>{startItem}</span> -{' '}
          <span style={{ color: 'var(--color-primary)' }}>{endItem}</span> / 共{' '}
          <span style={{ color: 'var(--color-primary)' }}>{totalItems}</span> 项
        </span>
      </div>

      {/* 右侧：页码导航 */}
      <div className="flex items-center gap-2">
        {/* 上一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          title="上一页"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>

        {/* 页码按钮 */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-3 py-1 text-sm"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  ...
                </span>
              );
            }

            const isActive = page === currentPage;
            return (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                className={clsx(
                  'px-3 py-1 rounded-lg text-sm font-medium transition-all duration-150'
                )}
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                  border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  color: isActive ? 'white' : 'var(--color-text-primary)',
                }}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* 下一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          title="下一页"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>

        {/* 快速跳转 */}
        {totalPages > 10 && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              跳转至
            </span>
            <input
              type="number"
              min={1}
              max={totalPages}
              defaultValue={currentPage}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const page = Number((e.target as HTMLInputElement).value);
                  if (page >= 1 && page <= totalPages) {
                    onPageChange(page);
                  }
                }
              }}
              className="w-16 px-2 py-1 rounded-lg text-sm text-center transition-all duration-150"
              style={{
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
