// 数字格式化工具函数

/**
 * 格式化数字，保留指定小数位
 * @param value 数值
 * @param decimals 小数位数，默认 2
 */
export function formatNumber(value: number, decimals = 2): string {
  if (value === 0) return '0';
  if (isNaN(value)) return '-';

  // 如果是整数，直接返回
  if (Number.isInteger(value)) {
    return value.toLocaleString('zh-CN');
  }

  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化字节大小
 * @param bytes 字节数
 * @param decimals 小数位数
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  if (isNaN(bytes)) return '-';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * 格式化 CPU 核心数
 * @param cores CPU 核心数
 * @param decimals 小数位数
 */
export function formatCPU(cores: number, decimals = 2): string {
  if (cores === 0) return '0';
  if (isNaN(cores)) return '-';

  // 如果小于 1，显示毫核
  if (cores < 1) {
    const millicores = cores * 1000;
    return `${formatNumber(millicores, 0)}m`;
  }

  return formatNumber(cores, decimals);
}

/**
 * 格式化内存大小 (GB)
 * @param gb 内存大小（GB）
 * @param decimals 小数位数
 */
export function formatMemory(gb: number, decimals = 2): string {
  if (gb === 0) return '0 GB';
  if (isNaN(gb)) return '-';

  // 如果小于 1GB，显示 MB
  if (gb < 1) {
    const mb = gb * 1024;
    return `${formatNumber(mb, decimals)} MB`;
  }

  // 如果大于等于 1TB
  if (gb >= 1024) {
    const tb = gb / 1024;
    return `${formatNumber(tb, decimals)} TB`;
  }

  return `${formatNumber(gb, decimals)} GB`;
}

/**
 * 格式化百分比
 * @param value 百分比值 (0-100)
 * @param decimals 小数位数
 */
export function formatPercent(value: number, decimals = 1): string {
  if (isNaN(value)) return '-';
  return `${formatNumber(value, decimals)}%`;
}

/**
 * 格式化资源使用量显示
 * @param used 已使用量
 * @param total 总量
 * @param unit 单位类型
 */
export function formatResourceUsage(
  used: number,
  total: number,
  unit: string
): { usedStr: string; totalStr: string; unit: string } {
  switch (unit.toLowerCase()) {
    case 'cores':
    case 'core':
      return {
        usedStr: formatCPU(used),
        totalStr: formatCPU(total),
        unit: 'Cores',
      };
    case 'gb':
    case 'gi':
      return {
        usedStr: formatNumber(used, 1),
        totalStr: formatNumber(total, 1),
        unit: 'GB',
      };
    case 'mb':
    case 'mi':
      return {
        usedStr: formatNumber(used, 1),
        totalStr: formatNumber(total, 1),
        unit: 'MB',
      };
    case 'pods':
    case 'pod':
      return {
        usedStr: formatNumber(used, 0),
        totalStr: formatNumber(total, 0),
        unit: 'Pods',
      };
    default:
      return {
        usedStr: formatNumber(used),
        totalStr: formatNumber(total),
        unit,
      };
  }
}

/**
 * 获取使用率对应的颜色等级
 * @param percentage 使用百分比
 */
export function getUsageLevel(percentage: number): 'low' | 'medium' | 'high' | 'critical' {
  if (percentage < 50) return 'low';
  if (percentage < 70) return 'medium';
  if (percentage < 90) return 'high';
  return 'critical';
}

/**
 * 获取使用率对应的颜色
 * @param percentage 使用百分比
 */
export function getUsageColor(percentage: number): string {
  const level = getUsageLevel(percentage);
  switch (level) {
    case 'low':
      return 'var(--color-success)';
    case 'medium':
      return 'var(--color-info)';
    case 'high':
      return 'var(--color-warning)';
    case 'critical':
      return 'var(--color-error)';
  }
}
