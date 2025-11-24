import React, { useState, useEffect } from 'react';
import { Minus, Plus, Edit2, Check, X } from 'lucide-react';

const ReplicaWidget = ({ current, desired, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(desired);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setValue(desired);
    }, [desired]);

    const handleUpdate = async () => {
        if (value === desired) {
            setIsEditing(false);
            return;
        }
        setLoading(true);
        try {
            await onUpdate(value);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update replicas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleUpdate();
        if (e.key === 'Escape') {
            setValue(desired);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center bg-black/40 rounded-lg border border-blue-500/50 p-1">
                <button
                    onClick={() => setValue(Math.max(0, value - 1))}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-muted-foreground hover:text-white"
                    disabled={loading}
                >
                    <Minus size={14} />
                </button>
                <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(parseInt(e.target.value) || 0)}
                    onKeyDown={handleKeyDown}
                    className="w-12 text-center bg-transparent border-none focus:outline-none text-sm font-bold mx-1"
                    autoFocus
                    disabled={loading}
                />
                <button
                    onClick={() => setValue(value + 1)}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-muted-foreground hover:text-white"
                    disabled={loading}
                >
                    <Plus size={14} />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                    onClick={handleUpdate}
                    className="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                    disabled={loading}
                >
                    <Check size={14} />
                </button>
                <button
                    onClick={() => {
                        setValue(desired);
                        setIsEditing(false);
                    }}
                    className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                    disabled={loading}
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-3 bg-black/20 rounded-lg border border-white/10 px-3 py-1.5">
            <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Replicas</span>
                <div className="flex items-baseline space-x-1">
                    <span className="text-lg font-bold text-white">{current}</span>
                    <span className="text-xs text-muted-foreground">/ {desired}</span>
                </div>
            </div>
            <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-blue-400"
                title="Edit Replicas"
            >
                <Edit2 size={14} />
            </button>
        </div>
    );
};

export default ReplicaWidget;
