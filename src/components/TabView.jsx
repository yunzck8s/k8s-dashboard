import React, { useState } from 'react';

const TabView = ({ tabs = [], defaultTab = 0 }) => {
    const [activeTab, setActiveTab] = useState(defaultTab);

    return (
        <div className="flex flex-col h-full">
            {/* Tab Headers */}
            <div className="flex space-x-1 border-b border-white/10 bg-black/20 px-4">
                {tabs.map((tab, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveTab(index)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === index
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-white/20'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            {tab.icon && <tab.icon size={16} />}
                            <span>{tab.label}</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
                {tabs[activeTab]?.content}
            </div>
        </div>
    );
};

export default TabView;
