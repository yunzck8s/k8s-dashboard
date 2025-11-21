import React, { useEffect, useState } from 'react';
import { Activity, Server, Box, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import Gauge from '../components/Gauge';
import { api } from '../services/api';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [pods, setPods] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsData, podsData] = await Promise.all([
                    api.getClusterStats(),
                    api.getPods()
                ]);
                setStats(statsData);
                setPods(podsData);
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Refresh data every 5 seconds
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    // Calculate namespace statistics
    const namespaceStats = React.useMemo(() => {
        const stats = {};
        pods.forEach(pod => {
            if (!stats[pod.namespace]) {
                stats[pod.namespace] = { total: 0, running: 0, failed: 0 };
            }
            stats[pod.namespace].total++;
            if (pod.status === 'Running') {
                stats[pod.namespace].running++;
            } else if (pod.status.includes('Error') || pod.status.includes('CrashLoop') || pod.status.includes('Failed')) {
                stats[pod.namespace].failed++;
            }
        });
        return Object.entries(stats)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5);
    }, [pods]);

    // Get recent problem pods
    const problemPods = React.useMemo(() => {
        return pods
            .filter(pod =>
                pod.status.includes('Error') ||
                pod.status.includes('CrashLoop') ||
                pod.status.includes('ImagePull') ||
                pod.status === 'Failed' ||
                pod.restarts > 5
            )
            .sort((a, b) => b.restarts - a.restarts)
            .slice(0, 5);
    }, [pods]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Cluster Overview</h1>
                <div className="flex items-center space-x-2">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">System Healthy</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Nodes"
                    value={stats?.totalNodes || 0}
                    icon={Server}
                    className="border-l-4 border-l-blue-500"
                />
                <StatsCard
                    title="Active Pods"
                    value={stats?.activePods || 0}
                    icon={Box}
                    className="border-l-4 border-l-purple-500"
                />
                <StatsCard
                    title="CPU Usage"
                    value={`${(stats?.cpuUsage || 0).toFixed(1)}%`}
                    icon={Activity}
                    className="border-l-4 border-l-indigo-500"
                />
                <StatsCard
                    title="Failed Pods"
                    value={stats?.failedPods || 0}
                    icon={AlertCircle}
                    className="border-l-4 border-l-red-500"
                />
            </div>

            {/* Gauges & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gauges */}
                <div className="space-y-6">
                    <Gauge
                        title="Cluster CPU Load"
                        value={parseFloat((stats?.cpuUsage || 0).toFixed(1))}
                        color="#6366f1"
                    />
                    <Gauge
                        title="Cluster Memory Usage"
                        value={parseFloat((stats?.memoryUsage || 0).toFixed(1))}
                        color="#8b5cf6"
                    />
                </div>

                {/* Namespace Overview */}
                <div className="rounded-xl glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Top Namespaces</h3>
                    <div className="space-y-3">
                        {namespaceStats.length > 0 ? (
                            namespaceStats.map(([ns, data]) => (
                                <div key={ns} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{ns}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {data.running} running {data.failed > 0 && `· ${data.failed} failed`}
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-400">{data.total}</div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-8">No namespaces found</div>
                        )}
                    </div>
                </div>

                {/* Problem Pods */}
                <div className="rounded-xl glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
                        Problem Pods
                    </h3>
                    <div className="space-y-3">
                        {problemPods.length > 0 ? (
                            problemPods.map((pod) => (
                                <div key={`${pod.namespace}/${pod.name}`} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">{pod.name}</div>
                                            <div className="text-xs text-muted-foreground mt-1">{pod.namespace}</div>
                                        </div>
                                        <div className="ml-2 flex flex-col items-end">
                                            <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                                                {pod.status}
                                            </span>
                                            {pod.restarts > 0 && (
                                                <span className="text-xs text-yellow-400 mt-1">
                                                    {pod.restarts} restarts
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
                                <div className="text-sm text-muted-foreground">All pods healthy!</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
