import React from 'react';

const GradientCard = ({ icon: Icon, label, value, unit, gradient = 'from-blue-500 to-cyan-500' }) => {
    return (
        <div className={`relative p-6 rounded-xl bg-gradient-to-br ${gradient} overflow-hidden group hover:scale-105 transition-transform duration-300`}>
            {/* Background decoration */}
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

            {/* Content */}
            <div className="relative z-10 flex items-center justify-between">
                <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                        {Icon && (
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Icon size={20} className="text-white" />
                            </div>
                        )}
                        <span className="text-white/90 text-sm font-medium">{label}</span>
                    </div>
                    <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-white">{value}</span>
                        {unit && <span className="text-white/70 text-sm font-medium">{unit}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GradientCard;
