import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, Box, Layers, Activity, Settings } from 'lucide-react';

const SidebarItem = ({ to, icon, label }) => {
    const Icon = icon;
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link
            to={to}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                ? 'text-white bg-white/10 shadow-lg shadow-blue-500/10 border border-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
        >
            {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            )}
            <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:scale-110'}`} />
            <span className="font-medium tracking-wide">{label}</span>
        </Link>
    );
};

const Layout = () => {
    return (
        <div className="flex h-screen bg-transparent text-foreground overflow-hidden font-sans selection:bg-blue-500/30">
            {/* Sidebar */}
            <aside className="w-72 glass flex flex-col relative z-20">
                <div className="p-8 border-b border-white/5">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight filter drop-shadow-lg">
                        K8s Dashboard
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
                    {/* Cluster Group */}
                    <div>
                        <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cluster</h3>
                        <div className="space-y-1">
                            <SidebarItem to="/" icon={LayoutDashboard} label="Overview" />
                            <SidebarItem to="/nodes" icon={Server} label="Nodes" />
                        </div>
                    </div>

                    {/* Workloads Group */}
                    <div>
                        <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Workloads</h3>
                        <div className="space-y-1">
                            <SidebarItem to="/pods" icon={Box} label="Pods" />
                            <SidebarItem to="/deployments" icon={Layers} label="Deployments" />
                        </div>
                    </div>

                    {/* Network Group */}
                    <div>
                        <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Network</h3>
                        <div className="space-y-1">
                            <SidebarItem to="/services" icon={Activity} label="Services" />
                        </div>
                    </div>
                </nav>

                <div className="p-4 border-t border-white/5">
                    <SidebarItem to="/settings" icon={Settings} label="Settings" />
                </div>
            </aside>

            {/* Main Content */}
            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative z-10">
                {/* Header */}
                <header className="h-20 glass border-b-0 border-white/5 flex items-center justify-between px-8">
                    <h2 className="text-xl font-semibold text-gray-100 tracking-wide">Dashboard</h2>
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-3 px-4 py-2 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                            <span className="text-sm text-gray-300">Cluster Active</span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-[1px] shadow-lg shadow-purple-500/20">
                            <div className="w-full h-full rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white font-bold text-sm">
                                A
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
