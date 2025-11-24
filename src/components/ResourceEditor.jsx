import React, { useEffect, useState } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import YamlEditor from './YamlEditor';
import { api } from '../services/api';
import Modal from './Modal';

const ResourceEditor = ({ isOpen, onClose, type = 'deployments', namespace, name, onUpdate }) => {
    const [yaml, setYaml] = useState('');
    const [originalYaml, setOriginalYaml] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && namespace && name) {
            fetchYaml();
        }
    }, [isOpen, namespace, name]);

    const fetchYaml = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getResourceYaml(type, namespace, name);
            setYaml(data.yaml);
            setOriginalYaml(data.yaml);
        } catch (err) {
            setError('Failed to load YAML');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            await api.updateResourceYaml(type, namespace, name, yaml);
            if (onUpdate) onUpdate();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setYaml(originalYaml);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit YAML - ${name}`} size="xl">
            <div className="flex flex-col h-[600px]">
                {/* Editor */}
                <div className="flex-1 border border-white/10 rounded-lg overflow-hidden bg-[#1e1e1e]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            Loading...
                        </div>
                    ) : (
                        <YamlEditor
                            value={yaml}
                            onChange={setYaml}
                            language="yaml"
                            theme="vs-dark"
                        />
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                    <button
                        onClick={handleReset}
                        className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground hover:text-white transition-colors"
                        title="Reset to original"
                    >
                        <RotateCcw size={14} />
                        <span>Reset</span>
                    </button>
                    <div className="flex items-center space-x-3">
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
                </div>
            </div>
        </Modal>
    );
};

export default ResourceEditor;
