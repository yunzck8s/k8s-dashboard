import React, { useEffect, useState } from 'react';
import { Activity, Server, Box, AlertCircle, Cpu, HardDrive, Database, Network } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import UsageBar from '../components/UsageBar';
import GradientCard from '../components/GradientCard';
import { api } from '../services/api';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [pods, setPods] = useState([]);
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsData, podsData, deploymentsData] = await Promise.all([
                    api.getClusterStats(),
                    api.getPods(),
                    api.getDeployments()
                ]);
                setStats(statsData);
                setPods(podsData);
                setDeployments(deploymentsData);
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">K8S资源总览</h1>
                    <p className="text-sm text-muted-foreground mt-1">实时监控</p>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">系统正常</span>
                </div>
            </div>

            {/* Top Resource Cards */}
            <div className="grid grid-cols-5 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">集群数量</div>
                    <div className="text-3xl font-bold">1</div>
                    <div className="text-xs text-muted-foreground mt-1">Kubernetes Clusters</div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">节点数量</div>
                    <div className="text-3xl font-bold">{stats?.totalNodes || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Nodes</div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">工作负载</div>
                    <div className="text-3xl font-bold">{deployments?.length || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Workloads</div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">容器组</div>
                    <div className="text-3xl font-bold">{stats?.activePods || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Pods</div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">持久卷</div>
                    <div className="text-3xl font-bold">0</div>
                    <div className="text-xs text-muted-foreground mt-1">PVCs</div>
                </div>
            </div>

            {/* Resource Usage Bars & Gradient Cards */}
            <div className="grid grid-cols-12 gap-6">
                {/* Left: Usage Bars */}
                <div className="col-span-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 p-6">
                    <h3 className="text-lg font-semibold mb-6">资源使用情况</h3>
                    <div className="space-y-6">
                        <UsageBar
                            label="集群CPU使用率"
                            sublabel="10.95 / 157"
                            percentage={stats?.cpuUsage || 0}
                        />
                        <UsageBar
                            label="集群内存使用率"
                            sublabel="16.5 GiB / 157 GiB"
                            percentage={stats?.memoryUsage || 0}
                        />
                        <UsageBar
                            label="集群CPU分配率"
                            sublabel="101.node-worker-ooqq0e0d"
                            percentage={65}
                        />
                        <UsageBar
                            label="集群存储分配率"
                            sublabel="10.1 / 17.25"
                            percentage={58.6}
                        />
                        <UsageBar
                            label="集群CPU请求率"
                            sublabel="10.5 / 38.25"
                            percentage={27.5}
                        />
                        <UsageBar
                            label="集群PVC使用率"
                            sublabel="nfs-vm - data-nfs-01"
                            percentage={84.08}
                        />
                    </div>
                </div>

                {/* Right: Gradient Cards */}
                <div className="col-span-7 grid grid-cols-3 gap-4">
                    <GradientCard
                        icon={Cpu}
                        label="CPU使用量"
                        value="1,860"
                        unit="m"
                        gradient="from-blue-500 via-cyan-500 to-blue-400"
                    />
                    <GradientCard
                        icon={Activity}
                        label="GPU使用量"
                        value="500"
                        unit="m"
                        gradient="from-orange-500 via-yellow-500 to-orange-400"
                    />
                    <GradientCard
                        icon={Network}
                        label="内存使用量"
                        value="6,955"
                        unit="GiB"
                        gradient="from-green-500 via-emerald-500 to-green-400"
                    />
                    <GradientCard
                        icon={Database}
                        label="内存请求量"
                        value="4,908"
                        unit="GiB"
                        gradient="from-cyan-500 via-blue-500 to-cyan-400"
                    />
                    <GradientCard
                        icon={HardDrive}
                        label="入站流量"
                        value="150"
                        unit="Mbps"
                        gradient="from-purple-500 via-pink-500 to-purple-400"
                    />
                    <GradientCard
                        icon={Server}
                        label="出站流量"
                        value="267"
                        unit="Mbps"
                        gradient="from-indigo-500 via-blue-500 to-indigo-400"
                    />
                </div>
            </div>

            {/* Charts Section (Placeholder for future) */}
            <div className="grid grid-cols-2 gap-6">
                <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 p-6">
                    <h3 className="text-lg font-semibold mb-4">今日累计 - Top10 异常 Pod 事件</h3>
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                        Chart placeholder
                    </div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 p-6">
                    <h3 className="text-lg font-semibold mb-4">累计 Pod 事件统计</h3>
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                        Chart placeholder
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
