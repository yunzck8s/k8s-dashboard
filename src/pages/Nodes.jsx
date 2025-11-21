import React, { useEffect, useState } from 'react';
import { Server } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
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
    const [nodes, setNodes] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [nodesData, metricsData] = await Promise.all([
                    api.getNodes(),
                    api.getAllNodeMetrics().catch(() => ({ items: [] })) // Handle case where metrics server is missing
                ]);

                const metricsMap = {};
                if (metricsData.items) {
                    metricsData.items.forEach(m => {
                        metricsMap[m.metadata.name] = m.usage;
                    });
                }
                setMetrics(metricsMap);
                setNodes(nodesData);
            } catch (error) {
                console.error('Failed to fetch nodes data', error);
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
                    <Server size={16} className="text-muted-foreground" />
                    <span className="font-medium">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'Version',
            accessor: 'version',
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
            header: 'Role',
            accessor: 'role',
        },
        {
            header: 'CPU (Cores)',
            accessor: 'cpu',
            render: (row) => {
                const capacity = parseCpu(row.cpu);
                const usage = metrics[row.name] ? parseCpu(metrics[row.name].cpu) : 0;
                const percentage = capacity > 0 ? (usage / capacity) * 100 : 0;

                return (
                    <div className="w-32">
                        <div className="flex justify-between text-xs mb-1">
                            <span>{usage.toFixed(2)}</span>
                            <span className="text-muted-foreground">/ {capacity}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Memory',
            accessor: 'memory',
            render: (row) => {
                const capacity = parseMemory(row.memory);
                const usage = metrics[row.name] ? parseMemory(metrics[row.name].memory) : 0;
                const percentage = capacity > 0 ? (usage / capacity) * 100 : 0;

                return (
                    <div className="w-32">
                        <div className="flex justify-between text-xs mb-1">
                            <span>{formatBytes(usage)}</span>
                            <span className="text-muted-foreground">/ {formatBytes(capacity)}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            }
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Nodes</h1>
                <div className="text-sm text-muted-foreground">
                    Total: {nodes.length}
                </div>
            </div>

            <div className="rounded-xl glass-card overflow-hidden">
                <Table columns={columns} data={nodes} loading={loading} />
            </div>
        </div>
    );
};

export default Nodes;
