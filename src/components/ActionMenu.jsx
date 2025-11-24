import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit, FileText, Terminal, Trash2, Code } from 'lucide-react';

const ActionMenu = ({ actions = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const iconMap = {
        edit: Edit,
        logs: FileText,
        terminal: Terminal,
        delete: Trash2,
        yaml: Code,
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Actions"
            >
                <MoreVertical size={16} className="text-muted-foreground" />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                    {actions.map((action, idx) => {
                        const Icon = iconMap[action.icon] || Edit;
                        return (
                            <button
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick();
                                    setIsOpen(false);
                                }}
                                disabled={action.disabled}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${action.disabled
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-white/10 cursor-pointer'
                                    } ${action.danger ? 'text-red-400' : 'text-foreground'}`}
                            >
                                <Icon size={16} />
                                <span>{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ActionMenu;
