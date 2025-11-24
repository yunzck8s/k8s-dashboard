import React, { useState } from 'react';
import { Search, RefreshCw, Plus, Filter } from 'lucide-react';

const FilterBar = ({
    searchValue,
    onSearchChange,
    namespaces = [],
    selectedNamespace,
    onNamespaceChange,
    onRefresh,
    onCreateClick,
    createLabel = "Create",
    showCreate = true
}) => {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        if (onRefresh) await onRefresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    return (
        <div className="flex items-center justify-between gap-4 p-4 bg-black/20 border-b border-white/10">
            {/* Left: Search */}
            <div className="flex-1 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                </div>
            </div>

            {/* Right: Filters and Actions */}
            <div className="flex items-center gap-3">
                {/* Namespace Filter */}
                {namespaces.length > 0 && (
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <select
                            value={selectedNamespace}
                            onChange={(e) => onNamespaceChange(e.target.value)}
                            className="pl-10 pr-8 py-2 bg-black/30 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer min-w-[150px]"
                        >
                            <option value="">All Namespaces</option>
                            {namespaces.map((ns) => (
                                <option key={ns} value={ns}>{ns}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Refresh Button */}
                <button
                    onClick={handleRefresh}
                    className="p-2 rounded-lg bg-black/30 border border-white/10 hover:bg-white/10 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>

                {/* Create Button */}
                {showCreate && (
                    <button
                        onClick={onCreateClick}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <Plus size={16} />
                        <span>{createLabel}</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default FilterBar;
