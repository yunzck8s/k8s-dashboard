import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const StatsCard = ({ title, value, icon: Icon, trend, className }) => {
    return (
        <div className={cn("p-6 rounded-xl glass-card relative overflow-hidden group", className)}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <h3 className="text-3xl font-bold mt-2">{value}</h3>
                    </div>
                    {Icon && (
                        <div className="p-3 rounded-full bg-primary/10 text-primary">
                            <Icon size={24} />
                        </div>
                    )}
                </div>
                {trend && (
                    <div className="mt-4 flex items-center text-sm">
                        <span className={cn("font-medium", trend > 0 ? "text-green-500" : "text-red-500")}>
                            {trend > 0 ? "+" : ""}{trend}%
                        </span>
                        <span className="text-muted-foreground ml-2">from last hour</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsCard;
