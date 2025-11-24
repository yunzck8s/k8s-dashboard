import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import Modal from './Modal';

const ScaleModal = ({ isOpen, onClose, resourceName, currentReplicas, onScale }) => {
    const [replicas, setReplicas] = useState(currentReplicas);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleScale = async () => {
        setLoading(true);
        setError(null);
        try {
            await onScale(replicas);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Scale ${resourceName}`} size="sm">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Number of Replicas</label>
                    <input
                        type="number"
                        min="0"
                        value={replicas}
                        onChange={(e) => setReplicas(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Current: {currentReplicas} → New: {replicas}
                    </p>
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 text-sm flex items-start space-x-2">
                        <AlertCircle size={16} className="mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleScale}
                        disabled={loading || replicas === currentReplicas}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Scaling...' : 'Scale'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ScaleModal;
