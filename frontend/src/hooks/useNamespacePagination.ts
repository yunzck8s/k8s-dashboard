import { useState } from 'react';

interface PaginationState {
  page: number;
  pageSize: number;
}

interface NamespacePaginationResult {
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export function useNamespacePagination(
  namespace: string,
  defaultPageSize: number = 20
): NamespacePaginationResult {
  const [stateByNamespace, setStateByNamespace] = useState<Record<string, PaginationState>>({});

  const currentState = stateByNamespace[namespace] ?? { page: 1, pageSize: defaultPageSize };

  const setCurrentPage = (page: number) => {
    setStateByNamespace((previous) => ({
      ...previous,
      [namespace]: {
        page,
        pageSize: previous[namespace]?.pageSize ?? defaultPageSize,
      },
    }));
  };

  const setPageSize = (pageSize: number) => {
    setStateByNamespace((previous) => ({
      ...previous,
      [namespace]: {
        page: 1,
        pageSize,
      },
    }));
  };

  return {
    currentPage: currentState.page,
    pageSize: currentState.pageSize,
    setCurrentPage,
    setPageSize,
  };
}
