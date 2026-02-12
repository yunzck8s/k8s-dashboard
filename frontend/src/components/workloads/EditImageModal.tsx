import { useState } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';

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

function parseImage(image: string): { repository: string; tag: string } {
  const lastColonIndex = image.lastIndexOf(':');
  const lastSlashIndex = image.lastIndexOf('/');

  if (lastColonIndex === -1 || lastColonIndex < lastSlashIndex) {
    return { repository: image, tag: 'latest' };
  }

  const tag = image.substring(lastColonIndex + 1);
  const repository = image.substring(0, lastColonIndex);

  return { repository, tag };
}

function combineImage(repository: string, tag: string): string {
  const trimmedRepo = repository.trim();
  const trimmedTag = tag.trim();

  if (!trimmedRepo) {
    return '';
  }
  if (!trimmedTag || trimmedTag === 'latest') {
    return trimmedRepo;
  }
  return `${trimmedRepo}:${trimmedTag}`;
}

function toEditedContainers(containers: Container[]): EditedContainer[] {
  return containers.map((container) => {
    const { repository, tag } = parseImage(container.image);
    return { name: container.name, repository, tag };
  });
}

function EditImageModalContent({
  onClose,
  onSave,
  containers,
  isPending = false,
}: Omit<EditImageModalProps, 'isOpen'>) {
  const [editedContainers, setEditedContainers] = useState<EditedContainer[]>(() =>
    toEditedContainers(containers)
  );

  const handleRepositoryChange = (index: number, value: string) => {
    setEditedContainers((previous) => {
      const updated = [...previous];
      updated[index] = { ...updated[index], repository: value };
      return updated;
    });
  };

  const handleTagChange = (index: number, value: string) => {
    setEditedContainers((previous) => {
      const updated = [...previous];
      updated[index] = { ...updated[index], tag: value };
      return updated;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = editedContainers.map((container) => ({
      name: container.name,
      image: combineImage(container.repository, container.tag),
    }));
    onSave(result);
  };

  const hasChanges = editedContainers.some((container, index) => {
    const newImage = combineImage(container.repository, container.tag);
    return newImage !== containers[index]?.image;
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <PhotoIcon className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">修改容器镜像</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-5 max-h-96 overflow-y-auto">
            {editedContainers.map((container, index) => {
              const originalImage = containers[index]?.image || '';
              const newImage = combineImage(container.repository, container.tag);
              const isChanged = newImage !== originalImage;

              return (
                <div key={container.name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-300">{container.name}</label>
                    {isChanged && (
                      <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                        已修改
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">镜像仓库</label>
                      <input
                        type="text"
                        value={container.repository}
                        onChange={(event) => handleRepositoryChange(index, event.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="nginx 或 registry.cn/repo/image"
                      />
                    </div>

                    <div className="flex items-end pb-2.5">
                      <span className="text-slate-500 text-lg font-bold">:</span>
                    </div>

                    <div className="w-36">
                      <label className="block text-xs text-slate-500 mb-1">标签</label>
                      <input
                        type="text"
                        value={container.tag}
                        onChange={(event) => handleTagChange(index, event.target.value)}
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

export default function EditImageModal(props: EditImageModalProps) {
  if (!props.isOpen) {
    return null;
  }

  const modalKey = props.containers.map((container) => `${container.name}:${container.image}`).join('|');

  return (
    <EditImageModalContent
      key={modalKey}
      onClose={props.onClose}
      onSave={props.onSave}
      containers={props.containers}
      isPending={props.isPending}
    />
  );
}
