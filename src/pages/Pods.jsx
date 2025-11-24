import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import FilterBar from '../components/FilterBar';
import { api } from '../services/api';

const Pods = () => {
    const navigate = useNavigate();
    const [pods, setPods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNamespace, setSelectedNamespace] = useState('');

    useEffect(() => {
        const fetchPods = async () => {
            try {
                const data = await api.getPods();
                setPods(data);
            } catch (error) {
                console.error('Failed to fetch pods', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPods();
        const interval = setInterval(fetchPods, 10000);
        return () => clearInterval(interval);
    }, []);

    const namespaces = useMemo(() => {
        const ns = [...new Set(pods.map(p => p.namespace))];
        return ns.sort();
    }, [pods]);

    const filteredPods = useMemo(() => {
        return pods.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.namespace.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesNamespace = !selectedNamespace || p.namespace === selectedNamespace;
            return matchesSearch && matchesNamespace;
        });
    }, [pods, searchTerm, selectedNamespace]);

    const getStatusVariant = (status) => {
        if (['Running', 'Succeeded'].includes(status)) return 'success';
        if (['Pending', 'ContainerCreating'].includes(status)) return 'warning';
        if (['Failed', 'CrashLoopBackOff', 'ErrImagePull', 'ImagePullBackOff', 'Error'].includes(status)) return 'error';
        return 'default';
    };

    const handleRowClick = (row) => {
        navigate(`/pods/${row.namespace}/${row.name}`);
    };

    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Box size={16} className="text-blue-400" />
                    <span className="font-medium">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'Namespace',
            accessor: 'namespace',
            render: (row) => (
                <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {row.namespace}
                </span>
            ),
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => (
                <Badge variant={getStatusVariant(row.status)}>{row.status}</Badge>
            ),
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
            render: (row) => <span className="text-muted-foreground text-sm">{row.age}</span>,
        },
    ];

    // Calculate stats
    const runningPods = pods.filter(p => p.status === 'Running').length;
    const failedPods = pods.filter(p =>
        ['Failed', 'CrashLoopBackOff', 'ErrImagePull', 'ImagePullBackOff', 'Error'].includes(p.status)
    ).length;
    const pendingPods = pods.filter(p => ['Pending', 'ContainerCreating'].includes(p.status)).length;

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pods</h1>
                    <p className="text-sm text-muted-foreground mt-1">Container pod management</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Box size={20} className="text-blue-400" />
                        </div>
                        <span className="text-2xl font-bold">{pods.length}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Total Pods</div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <CheckCircle size={20} className="text-green-400" />
                        </div>
                        <span className="text-2xl font-bold text-green-400">{runningPods}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Running</div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <AlertTriangle size={20} className="text-yellow-400" />
                        </div>
                        <span className="text-2xl font-bold text-yellow-400">{pendingPods}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Pending</div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <XCircle size={20} className="text-red-400" />
                        </div>
                        <span className="text-2xl font-bold text-red-400">{failedPods}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Failed</div>
                </div>
            </div>

            {/* Filter Bar */}
            <FilterBar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                namespaces={namespaces}
                selectedNamespace={selectedNamespace}
                onNamespaceChange={setSelectedNamespace}
                onRefresh={() => window.location.reload()}
                showCreate={false}
            />

            {/* Pods Table */}
            <div className="flex-1 overflow-auto">
                <div className="rounded-xl border border-white/10 overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50">
                    <Table columns={columns} data={filteredPods} loading={loading} onRowClick={handleRowClick} />
                </div>
            </div>
        </div>
    );
};

export default Pods;
