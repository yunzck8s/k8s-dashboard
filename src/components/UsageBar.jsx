import React from 'react';

const UsageBar = ({ label, value, total, percentage, sublabel }) => {
    const getColor = (pct) => {
        if (pct >= 90) return 'from-red-500 to-red-600';
        if (pct >= 70) return 'from-orange-500 to-orange-600';
        return 'from-green-500 to-green-600';
    };

    const pct = percentage || (total > 0 ? (value / total) * 100 : 0);
    const colorClass = getColor(pct);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                    <span className="text-foreground font-medium">{label}</span>
                    {sublabel && <span className="text-muted-foreground text-xs">{sublabel}</span>}
                </div>
                <span className="text-foreground font-bold">{pct.toFixed(2)}%</span>
            </div>
            <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
        </div>
    );
};

export default UsageBar;
