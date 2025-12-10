import { useState, useEffect } from 'react';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface Container {
  name: string;
  image: string;
}

interface EditImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (containers: Container[]) => void;
  containers: Container[];
  isPending?: boolean;
}

export default function EditImageModal({
  isOpen,
  onClose,
  onSave,
  containers,
  isPending = false,
}: EditImageModalProps) {
  const [editedContainers, setEditedContainers] = useState<Container[]>([]);

  useEffect(() => {
    if (isOpen) {
      setEditedContainers(containers.map(c => ({ ...c })));
    }
  }, [isOpen, containers]);

  const handleImageChange = (index: number, newImage: string) => {
    const updated = [...editedContainers];
    updated[index] = { ...updated[index], image: newImage };
    setEditedContainers(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedContainers);
  };

  const hasChanges = editedContainers.some(
    (c, i) => c.image !== containers[i]?.image
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl">
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
          <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
            {editedContainers.map((container, index) => (
              <div key={container.name} className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">
                  {container.name}
                </label>
                <input
                  type="text"
                  value={container.image}
                  onChange={(e) => handleImageChange(index, e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="输入镜像地址，如 nginx:1.21"
                />
                {container.image !== containers[index]?.image && (
                  <p className="text-xs text-yellow-400">
                    原镜像: {containers[index]?.image}
                  </p>
                )}
              </div>
            ))}
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
