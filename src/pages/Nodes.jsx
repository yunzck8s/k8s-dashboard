import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Cpu, HardDrive } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import UsageBar from '../components/UsageBar';
import { api } from '../services/api';

const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const parseCpu = (cpuStr) => {
    if (!cpuStr) return 0;
    if (cpuStr.endsWith('n')) return parseInt(cpuStr) / 1000000000;
    if (cpuStr.endsWith('m')) return parseInt(cpuStr) / 1000;
    return parseFloat(cpuStr);
};

const parseMemory = (memStr) => {
    if (!memStr) return 0;
    if (memStr.endsWith('Ki')) return parseInt(memStr) * 1024;
    if (memStr.endsWith('Mi')) return parseInt(memStr) * 1024 * 1024;
    if (memStr.endsWith('Gi')) return parseInt(memStr) * 1024 * 1024 * 1024;
    return parseInt(memStr);
};

const Nodes = () => {
    const navigate = useNavigate();
    const [nodes, setNodes] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [nodesData, metricsData] = await Promise.all([
                    api.getNodes(),
                    api.getAllNodeMetrics().catch(() => ({ items: [] }))
                ]);

                const metricsMap = {};
                if (metricsData.items) {
                    metricsData.items.forEach(m => {
                        metricsMap[m.metadata.name] = m.usage;
                    });
                }

                setNodes(nodesData);
                setMetrics(metricsMap);
            } catch (error) {
                console.error('Failed to fetch nodes', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Server size={16} className="text-blue-400" />
                    <span className="font-medium">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => {
                const variant = row.status === 'Ready' ? 'success' : 'error';
                return <Badge variant={variant}>{row.status}</Badge>;
            },
        },
        {
            header: 'Roles',
            accessor: 'roles',
            render: (row) => (
                <div className="flex flex-wrap gap-1">
                    {(row.roles || []).map(role => (
                        <span key={role} className="text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {role}
                        </span>
                    ))}
                </div>
            ),
        },
        {
            header: 'CPU',
            accessor: 'name',
            render: (row) => {
                const usage = metrics[row.name];
                if (!usage) return <span className="text-muted-foreground text-sm">-</span>;

                const cpuUsed = parseCpu(usage.cpu);
                const cpuTotal = parseCpu(row.capacity?.cpu || '0');
                const cpuPercent = cpuTotal > 0 ? (cpuUsed / cpuTotal) * 100 : 0;

                return (
                    <div className="w-32">
                        <div className="text-xs text-muted-foreground mb-1">{cpuPercent.toFixed(1)}%</div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                                style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            },
        },
        {
            header: 'Memory',
            accessor: 'name',
            render: (row) => {
                const usage = metrics[row.name];
                if (!usage) return <span className="text-muted-foreground text-sm">-</span>;

                const memUsed = parseMemory(usage.memory);
                const memTotal = parseMemory(row.capacity?.memory || '0');
                const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

                return (
                    <div className="w-32">
                        <div className="text-xs text-muted-foreground mb-1">{memPercent.toFixed(1)}%</div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                style={{ width: `${Math.min(memPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            },
        },
        {
            header: 'Age',
            accessor: 'age',
            render: (row) => <span className="text-muted-foreground text-sm">{row.age}</span>,
        },
    ];

    // Calculate aggregate stats (only if nodes exist)
    const totalCpu = nodes.length > 0 ? nodes.reduce((sum, node) => sum + parseCpu(node.capacity?.cpu || '0'), 0) : 0;
    const totalMemory = nodes.length > 0 ? nodes.reduce((sum, node) => sum + parseMemory(node.capacity?.memory || '0'), 0) : 0;
    const usedCpu = nodes.length > 0 ? nodes.reduce((sum, node) => {
        const usage = metrics[node.name];
        return sum + (usage ? parseCpu(usage.cpu) : 0);
    }, 0) : 0;
    const usedMemory = nodes.length > 0 ? nodes.reduce((sum, node) => {
        const usage = metrics[node.name];
        return sum + (usage ? parseMemory(usage.memory) : 0);
    }, 0) : 0;

    const cpuPercent = totalCpu > 0 ? (usedCpu / totalCpu) * 100 : 0;
    const memPercent = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Nodes</h1>
                    <p className="text-sm text-muted-foreground mt-1">Cluster node management</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{nodes.length} Total</Badge>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Server size={24} className="text-blue-400" />
                        </div>
                        <span className="text-3xl font-bold">{nodes.length}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Total Nodes</div>
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Cpu size={24} className="text-purple-400" />
                        </div>
                        <span className="text-3xl font-bold">{totalCpu.toFixed(0)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Total CPU Cores</div>
                    {totalCpu > 0 && (
                        <div className="mt-3">
                            <UsageBar
                                label=""
                                value={usedCpu}
                                total={totalCpu}
                                percentage={cpuPercent}
                            />
                        </div>
                    )}
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <HardDrive size={24} className="text-green-400" />
                        </div>
                        <span className="text-3xl font-bold">{formatBytes(totalMemory)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">Total Memory</div>
                    {totalMemory > 0 && (
                        <div className="mt-3">
                            <UsageBar
                                label=""
                                value={usedMemory}
                                total={totalMemory}
                                percentage={memPercent}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Nodes Table */}
            <div className="flex-1 overflow-auto">
                <div className="rounded-xl border border-white/10 overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50">
                    <Table
                        columns={columns}
                        data={nodes}
                        loading={loading}
                        onRowClick={(row) => navigate(`/nodes/${row.name}`)}
                    />
                </div>
            </div>
        </div>
    );
};

export default Nodes;
