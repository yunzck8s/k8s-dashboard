import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Activity, Cpu, HardDrive, AlertCircle, Box, Terminal, FileText } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { api } from '../services/api';

const NodeDetail = () => {
    const { name } = useParams();
    const navigate = useNavigate();
    const [node, setNode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [nodeData, metricsData] = await Promise.all([
                    api.getNodeDetail(name),
                    api.getNodeMetrics(name).catch(() => null)
                ]);
                setNode(nodeData);
                setMetrics(metricsData);
            } catch (error) {
                console.error('Failed to fetch node details', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [name]);

    const podColumns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Box size={14} className="text-muted-foreground" />
                    <button
                        onClick={() => navigate(`/pods/${row.namespace}/${row.name}`)}
                        className="font-medium text-sm text-blue-400 hover:text-blue-300 hover:underline"
                    >
                        {row.name}
                    </button>
                </div>
            ),
        },
        {
            header: 'Namespace',
            accessor: 'namespace',
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => {
                const variant = row.status === 'Running' ? 'success' :
                    row.status.includes('Error') || row.status.includes('CrashLoop') ? 'error' : 'warning';
                return <Badge variant={variant}>{row.status}</Badge>;
            },
        },
        {
            header: 'Restarts',
            accessor: 'restarts',
            render: (row) => (
                <span className={row.restarts > 5 ? 'text-yellow-400' : 'text-muted-foreground'}>
                    {row.restarts}
                </span>
            ),
        },
        {
            header: 'Age',
            accessor: 'age',
            render: (row) => <span className="text-sm text-muted-foreground">{row.age}</span>,
        },
    ];

    const conditionColumns = [
        { header: 'Type', accessor: 'type', render: (row) => <span className="font-medium">{row.type}</span> },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => (
                <Badge variant={row.status === 'True' ? (row.type === 'Ready' ? 'success' : 'error') : (row.type === 'Ready' ? 'error' : 'success')}>
                    {row.status}
                </Badge>
            )
        },
        { header: 'Reason', accessor: 'reason' },
        { header: 'Message', accessor: 'message', render: (row) => <span className="text-xs text-muted-foreground truncate max-w-xs block" title={row.message}>{row.message}</span> },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!node) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Node Not Found</h2>
                <button
                    onClick={() => navigate('/nodes')}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    Back to Nodes
                </button>
            </div>
        );
    }

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

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const cpuCapacity = parseCpu(node.resources.cpu);
    const cpuUsage = metrics ? parseCpu(metrics.usage.cpu) : 0;
    const cpuPercent = cpuCapacity > 0 ? (cpuUsage / cpuCapacity) * 100 : 0;

    const memCapacity = parseMemory(node.resources.memory);
    const memUsage = metrics ? parseMemory(metrics.usage.memory) : 0;
    const memPercent = memCapacity > 0 ? (memUsage / memCapacity) * 100 : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate('/nodes')}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center space-x-3">
                        <h1 className="text-3xl font-bold tracking-tight">{node.name}</h1>
                        <Badge variant={node.status === 'Ready' ? 'success' : 'error'}>{node.status}</Badge>
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span>Role: {node.roles}</span>
                        <span>Version: {node.version}</span>
                        <span>Age: {node.age}</span>
                    </div>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-xl glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-muted-foreground">CPU Usage</span>
                        <Cpu className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-3xl font-bold mb-2">{cpuUsage.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ {cpuCapacity} Cores</span></div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(cpuPercent, 100)}%` }} />
                    </div>
                    <div className="text-right text-xs text-muted-foreground mt-1">{cpuPercent.toFixed(1)}%</div>
                </div>

                <div className="rounded-xl glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-muted-foreground">Memory Usage</span>
                        <Activity className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-3xl font-bold mb-2">{formatBytes(memUsage)} <span className="text-sm font-normal text-muted-foreground">/ {formatBytes(memCapacity)}</span></div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${Math.min(memPercent, 100)}%` }} />
                    </div>
                    <div className="text-right text-xs text-muted-foreground mt-1">{memPercent.toFixed(1)}%</div>
                </div>

                <div className="rounded-xl glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-muted-foreground">Pods</span>
                        <Box className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-3xl font-bold mb-2">{node.pods.length} <span className="text-sm font-normal text-muted-foreground">/ {node.resources.pods}</span></div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${Math.min((node.pods.length / parseInt(node.resources.pods)) * 100, 100)}%` }} />
                    </div>
                </div>
            </div>

            {/* System Info & Addresses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">System Info</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-muted-foreground">OS Image</span>
                            <span className="text-sm font-medium">{node.systemInfo.osImage}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-muted-foreground">Kernel Version</span>
                            <span className="text-sm font-medium">{node.systemInfo.kernelVersion}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-muted-foreground">Container Runtime</span>
                            <span className="text-sm font-medium">{node.systemInfo.containerRuntimeVersion}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-muted-foreground">Kubelet Version</span>
                            <span className="text-sm font-medium">{node.systemInfo.kubeletVersion}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-muted-foreground">Architecture</span>
                            <span className="text-sm font-medium">{node.systemInfo.architecture}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Addresses & Network</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-muted-foreground">Internal IP</span>
                            <span className="text-sm font-medium font-mono">{node.internalIP}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-muted-foreground">External IP</span>
                            <span className="text-sm font-medium font-mono">{node.externalIP || '-'}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-sm text-muted-foreground">Pod CIDR</span>
                            <span className="text-sm font-medium font-mono">{node.podCIDR}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Conditions */}
            <div className="rounded-xl glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Conditions</h3>
                <Table columns={conditionColumns} data={node.conditions} />
            </div>

            {/* Pods */}
            <div className="rounded-xl glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Pods ({node.pods.length})</h3>
                <Table columns={podColumns} data={node.pods} />
            </div>
        </div>
    );
};

export default NodeDetail;
