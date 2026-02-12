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
    <div className="flex flex-col gap-4 border-t border-[var(--color-border)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
      {/* 左侧：每页显示数量 */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <span className="text-sm text-[var(--color-text-secondary)]">
          每页显示
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className="min-h-[40px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-1 text-sm font-medium text-[var(--color-text-primary)] transition-all duration-150 hover:border-[var(--color-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="每页显示条数"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-sm text-[var(--color-text-muted)]">
          显示 <span className="text-[var(--color-primary)]">{startItem}</span> -{' '}
          <span className="text-[var(--color-primary)]">{endItem}</span> / 共{' '}
          <span className="text-[var(--color-primary)]">{totalItems}</span> 项
        </span>
      </div>

      {/* 右侧：页码导航 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 上一页按钮 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)] disabled:cursor-not-allowed disabled:opacity-30"
          title="上一页"
          aria-label="上一页"
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
                  className="px-3 py-1 text-sm text-[var(--color-text-muted)]"
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
                  'min-h-[40px] rounded-lg border px-3 py-1 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'border-primary bg-primary text-white'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)]'
                )}
                aria-label={`跳转到第 ${page} 页`}
                aria-current={isActive ? 'page' : undefined}
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
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] transition-all hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)] disabled:cursor-not-allowed disabled:opacity-30"
          title="下一页"
          aria-label="下一页"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>

        {/* 快速跳转 */}
        {totalPages > 10 && (
          <div className="ml-2 flex items-center gap-2 md:ml-4">
            <span className="text-sm text-[var(--color-text-secondary)]">
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
              className="input h-10 w-16 rounded-lg px-2 py-1 text-center text-sm"
              aria-label="输入页码后回车跳转"
            />
          </div>
        )}
      </div>
    </div>
  );
}
