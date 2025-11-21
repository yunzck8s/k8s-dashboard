import React, { useEffect, useState } from 'react';
import { Activity, Server, Box, AlertCircle } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import ResourceChart from '../components/ResourceChart';
import { api } from '../services/api';

// Mock chart data generator
const generateChartData = () => {
    const data = [];
    const now = new Date();
    for (let i = 10; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        data.push({
            time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            cpu: Math.floor(Math.random() * 30) + 20,
            memory: Math.floor(Math.random() * 20) + 40,
        });
    }
    return data;
};

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await api.getClusterStats();
                setStats(data);
                setChartData(generateChartData());
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
                    trend={12}
                    className="border-l-4 border-l-purple-500"
                />
                <StatsCard
                    title="CPU Usage"
                    value={`${stats?.cpuUsage}%`}
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResourceChart
                    title="CPU Usage History"
                    data={chartData}
                    dataKey="cpu"
                    color="#6366f1"
                />
                <ResourceChart
                    title="Memory Usage History"
                    data={chartData}
                    dataKey="memory"
                    color="#8b5cf6"
                />
            </div>
        </div>
    );
};

export default Dashboard;
