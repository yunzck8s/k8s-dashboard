import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { configMapApi } from '../../../api';
import { useAppStore } from '../../../store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function ConfigMaps() {
  const { currentNamespace } = useAppStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['configmaps', currentNamespace],
    queryFn: () =>
      currentNamespace === 'all'
        ? configMapApi.listAll()
        : configMapApi.list(currentNamespace),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">加载失败：{(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn btn-primary mt-4">
          重试
        </button>
      </div>
    );
  }

  const configMaps = data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ConfigMaps</h1>
          <p className="text-slate-400 mt-1">
            共 {configMaps.length} 个 ConfigMap
            {currentNamespace !== 'all' && ` 在 ${currentNamespace} 命名空间`}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          刷新
        </button>
      </div>

      {/* ConfigMap 列表 */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                {currentNamespace === 'all' && <th>命名空间</th>}
                <th>数据条数</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {configMaps.map((cm) => (
                <tr key={cm.metadata.uid}>
                  <td>
                    <Link
                      to={`/config/configmaps/${cm.metadata.namespace}/${cm.metadata.name}`}
                      className="text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {cm.metadata.name}
                    </Link>
                  </td>
                  {currentNamespace === 'all' && (
                    <td>
                      <span className="badge badge-default">{cm.metadata.namespace}</span>
                    </td>
                  )}
                  <td className="text-slate-400">
                    {Object.keys(cm.data || {}).length} 条
                  </td>
                  <td className="text-slate-400">
                    {formatDistanceToNow(new Date(cm.metadata.creationTimestamp), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {configMaps.length === 0 && (
          <div className="text-center py-12 text-slate-400">没有找到 ConfigMap</div>
        )}
      </div>
    </div>
  );
}
