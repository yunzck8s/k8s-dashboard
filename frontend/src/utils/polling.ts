import { useMemo } from 'react';
import { useAppStore } from '../store';

export type PollingMode = 'standard' | 'fast' | 'slow';

function normalizeSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.max(5, Math.round(value));
}

export function usePollingInterval(mode: PollingMode = 'standard'): number {
  const refreshInterval = useAppStore((state) => state.refreshInterval);

  return useMemo(() => {
    const baseMs = normalizeSeconds(refreshInterval) * 1000;
    if (mode === 'fast') {
      return Math.max(5000, Math.floor(baseMs / 2));
    }
    if (mode === 'slow') {
      return baseMs * 2;
    }
    return baseMs;
  }, [mode, refreshInterval]);
}
