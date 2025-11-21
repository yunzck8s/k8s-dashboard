import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'large' }) => {
    if (!isOpen) return null;

    const sizeClasses = {
        small: 'max-w-md',
        medium: 'max-w-2xl',
        large: 'max-w-6xl',
        full: 'max-w-[95vw]'
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`relative ${sizeClasses[size]} w-full max-h-[90vh] rounded-xl glass-card overflow-hidden shadow-2xl z-[10000]`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#1a1f2e]">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-auto max-h-[calc(90vh-80px)] bg-[#0f1419]">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
