import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Badge = ({ children, variant = 'default' }) => {
    const variants = {
        default: 'bg-muted text-muted-foreground',
        success: 'bg-green-500/10 text-green-500 border border-green-500/20',
        warning: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
        error: 'bg-red-500/10 text-red-500 border border-red-500/20',
        info: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                variants[variant]
            )}
        >
            {children}
        </span>
    );
};

export default Badge;
