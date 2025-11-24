import React, { useState, useEffect } from 'react';
import { X, Save, Box, Settings, Database, Activity, HardDrive } from 'lucide-react';
import Modal from './Modal';

const ConfigEditor = ({ isOpen, onClose, deployment, onSave }) => {
    const [activeSection, setActiveSection] = useState('deployment');
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (deployment) {
            // Deep copy to avoid mutating original
            setConfig(JSON.parse(JSON.stringify(deployment)));
        }
    }, [deployment]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave(config);
            onClose();
        } catch (error) {
            console.error('Failed to save config:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!config) return null;

    const container = config.spec?.template?.spec?.containers?.[0] || {};

    const updateContainer = (field, value) => {
        const newConfig = { ...config };
        if (!newConfig.spec.template.spec.containers[0]) {
            newConfig.spec.template.spec.containers[0] = {};
        }
        newConfig.spec.template.spec.containers[0][field] = value;
        setConfig(newConfig);
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'deployment':
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium border-b border-white/10 pb-2">Deployment Settings</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Replicas</label>
                                <input
                                    type="number"
                                    value={config.spec?.replicas || 1}
                                    onChange={(e) => {
                                        const newConfig = { ...config };
                                        newConfig.spec.replicas = parseInt(e.target.value);
                                        setConfig(newConfig);
                                    }}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Strategy</label>
                                <select
                                    value={config.spec?.strategy?.type || 'RollingUpdate'}
                                    onChange={(e) => {
                                        const newConfig = { ...config };
                                        if (!newConfig.spec.strategy) newConfig.spec.strategy = {};
                                        newConfig.spec.strategy.type = e.target.value;
                                        setConfig(newConfig);
                                    }}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg"
                                >
                                    <option value="RollingUpdate">RollingUpdate</option>
                                    <option value="Recreate">Recreate</option>
                                </select>
                            </div>
                        </div>
                    </div>
                );
            case 'container':
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium border-b border-white/10 pb-2">Container Settings</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Image</label>
                                <input
                                    type="text"
                                    value={container.image || ''}
                                    onChange={(e) => updateContainer('image', e.target.value)}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Image Pull Policy</label>
                                <select
                                    value={container.imagePullPolicy || 'Always'}
                                    onChange={(e) => updateContainer('imagePullPolicy', e.target.value)}
                                    className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg"
                                >
                                    <option value="Always">Always</option>
                                    <option value="IfNotPresent">IfNotPresent</option>
                                    <option value="Never">Never</option>
                                </select>
                            </div>
                        </div>
                    </div>
                );
            case 'env':
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium border-b border-white/10 pb-2">Environment Variables</h3>
                        <div className="space-y-3">
                            {(container.env || []).map((env, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Name"
                                        value={env.name}
                                        onChange={(e) => {
                                            const newEnv = [...(container.env || [])];
                                            newEnv[idx].name = e.target.value;
                                            updateContainer('env', newEnv);
                                        }}
                                        className="flex-1 px-3 py-2 bg-black/20 border border-white/10 rounded-lg"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Value"
                                        value={env.value}
                                        onChange={(e) => {
                                            const newEnv = [...(container.env || [])];
                                            newEnv[idx].value = e.target.value;
                                            updateContainer('env', newEnv);
                                        }}
                                        className="flex-1 px-3 py-2 bg-black/20 border border-white/10 rounded-lg"
                                    />
                                    <button
                                        onClick={() => {
                                            const newEnv = container.env.filter((_, i) => i !== idx);
                                            updateContainer('env', newEnv);
                                        }}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    const newEnv = [...(container.env || []), { name: '', value: '' }];
                                    updateContainer('env', newEnv);
                                }}
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                + Add Variable
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Configuration" size="xl">
            <div className="flex h-[600px]">
                {/* Sidebar */}
                <div className="w-64 border-r border-white/10 pr-4 space-y-2">
                    <button
                        onClick={() => setActiveSection('deployment')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeSection === 'deployment' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5'
                            }`}
                    >
                        <Settings size={18} />
                        <span>Deployment</span>
                    </button>
                    <div className="pt-4 pb-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Container
                    </div>
                    <button
                        onClick={() => setActiveSection('container')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeSection === 'container' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5'
                            }`}
                    >
                        <Box size={18} />
                        <span>General</span>
                    </button>
                    <button
                        onClick={() => setActiveSection('env')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeSection === 'env' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5'
                            }`}
                    >
                        <Database size={18} />
                        <span>Environment</span>
                    </button>
                    <button
                        onClick={() => setActiveSection('health')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeSection === 'health' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5'
                            }`}
                    >
                        <Activity size={18} />
                        <span>Health Checks</span>
                    </button>
                    <button
                        onClick={() => setActiveSection('storage')}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${activeSection === 'storage' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5'
                            }`}
                    >
                        <HardDrive size={18} />
                        <span>Storage</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 pl-6 overflow-y-auto">
                    {renderSection()}
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-white/10">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Save size={16} />
                    <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
            </div>
        </Modal>
    );
};

export default ConfigEditor;
