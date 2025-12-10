import { useState, useEffect } from 'react';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface Container {
  name: string;
  image: string;
}

interface EditedContainer {
  name: string;
  repository: string;
  tag: string;
}

interface EditImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (containers: Container[]) => void;
  containers: Container[];
  isPending?: boolean;
}

// 解析镜像为仓库和标签
function parseImage(image: string): { repository: string; tag: string } {
  // 处理带端口的仓库地址，如 registry.example.com:5000/nginx:1.21
  // 规则：最后一个冒号后面如果不包含 / 则认为是标签
  const lastColonIndex = image.lastIndexOf(':');
  const lastSlashIndex = image.lastIndexOf('/');

  // 如果没有冒号，或者最后一个冒号在最后一个斜杠之前（说明是端口号），则没有标签
  if (lastColonIndex === -1 || lastColonIndex < lastSlashIndex) {
    return { repository: image, tag: 'latest' };
  }

  const tag = image.substring(lastColonIndex + 1);
  const repository = image.substring(0, lastColonIndex);

  return { repository, tag };
}

// 合并仓库和标签为完整镜像地址
function combineImage(repository: string, tag: string): string {
  const trimmedRepo = repository.trim();
  const trimmedTag = tag.trim();

  if (!trimmedRepo) return '';
  if (!trimmedTag || trimmedTag === 'latest') {
    return trimmedRepo;
  }
  return `${trimmedRepo}:${trimmedTag}`;
}

export default function EditImageModal({
  isOpen,
  onClose,
  onSave,
  containers,
  isPending = false,
}: EditImageModalProps) {
  const [editedContainers, setEditedContainers] = useState<EditedContainer[]>([]);

  useEffect(() => {
    if (isOpen) {
      setEditedContainers(
        containers.map(c => {
          const { repository, tag } = parseImage(c.image);
          return { name: c.name, repository, tag };
        })
      );
    }
  }, [isOpen, containers]);

  const handleRepositoryChange = (index: number, value: string) => {
    const updated = [...editedContainers];
    updated[index] = { ...updated[index], repository: value };
    setEditedContainers(updated);
  };

  const handleTagChange = (index: number, value: string) => {
    const updated = [...editedContainers];
    updated[index] = { ...updated[index], tag: value };
    setEditedContainers(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = editedContainers.map(c => ({
      name: c.name,
      image: combineImage(c.repository, c.tag),
    }));
    onSave(result);
  };

  const hasChanges = editedContainers.some((c, i) => {
    const newImage = combineImage(c.repository, c.tag);
    return newImage !== containers[i]?.image;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl">
        {/* 标题 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <PhotoIcon className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">修改容器镜像</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-5 max-h-96 overflow-y-auto">
            {editedContainers.map((container, index) => {
              const originalImage = containers[index]?.image || '';
              const newImage = combineImage(container.repository, container.tag);
              const isChanged = newImage !== originalImage;

              return (
                <div key={container.name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-300">
                      {container.name}
                    </label>
                    {isChanged && (
                      <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                        已修改
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {/* 仓库地址 */}
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">镜像仓库</label>
                      <input
                        type="text"
                        value={container.repository}
                        onChange={(e) => handleRepositoryChange(index, e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="nginx 或 registry.cn/repo/image"
                      />
                    </div>

                    {/* 分隔符 */}
                    <div className="flex items-end pb-2.5">
                      <span className="text-slate-500 text-lg font-bold">:</span>
                    </div>

                    {/* 标签 */}
                    <div className="w-36">
                      <label className="block text-xs text-slate-500 mb-1">标签</label>
                      <input
                        type="text"
                        value={container.tag}
                        onChange={(e) => handleTagChange(index, e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="latest"
                      />
                    </div>
                  </div>

                  {isChanged && (
                    <div className="text-xs space-y-1 p-2 bg-slate-900/50 rounded-lg">
                      <p className="text-slate-500">
                        原镜像: <span className="text-slate-400 font-mono">{originalImage}</span>
                      </p>
                      <p className="text-slate-500">
                        新镜像: <span className="text-blue-400 font-mono">{newImage}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!hasChanges || isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
