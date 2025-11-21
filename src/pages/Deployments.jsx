import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Activity, CheckCircle, AlertTriangle, Filter } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import StatsCard from '../components/StatsCard';
import { api } from '../services/api';

const Deployments = () => {
    const navigate = useNavigate();
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedNamespace, setSelectedNamespace] = useState('all');

    useEffect(() => {
        const fetchDeployments = async () => {
            try {
                const data = await api.getDeployments();
                setDeployments(data);
            } catch (error) {
                console.error('Failed to fetch deployments', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDeployments();
        const interval = setInterval(fetchDeployments, 10000);
        return () => clearInterval(interval);
    }, []);

    // Get unique namespaces
    const namespaces = useMemo(() => {
        const ns = [...new Set(deployments.map(d => d.namespace))];
        return ns.sort();
    }, [deployments]);

    // Filter deployments by namespace
    const filteredDeployments = useMemo(() => {
        if (selectedNamespace === 'all') return deployments;
        return deployments.filter(d => d.namespace === selectedNamespace);
    }, [deployments, selectedNamespace]);

    // Calculate statistics
    const stats = useMemo(() => {
        const total = filteredDeployments.length;
        let healthy = 0;
        let degraded = 0;
        let updating = 0;

        filteredDeployments.forEach(d => {
            const [ready, desired] = d.replicas.split('/').map(Number);
            if (ready === desired && desired > 0) {
                healthy++;
            } else if (ready < desired) {
                degraded++;
            }
            // Note: We don't have "updating" status from backend yet, so this is placeholder
        });

        return { total, healthy, degraded, updating };
    }, [filteredDeployments]);

    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Layers size={16} className="text-muted-foreground" />
                    <span className="font-medium">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'Namespace',
            accessor: 'namespace',
            render: (row) => (
                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                    {row.namespace}
                </span>
            ),
        },
        {
            header: 'Replicas',
            accessor: 'replicas',
            render: (row) => {
                const [ready, desired] = row.replicas.split('/').map(Number);
                const percentage = desired > 0 ? (ready / desired) * 100 : 0;
                const variant = ready === desired ? 'success' : ready === 0 ? 'error' : 'warning';

                return (
                    <div className="w-32">
                        <div className="flex justify-between text-xs mb-1">
                            <Badge variant={variant}>{row.replicas}</Badge>
                            <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${variant === 'success' ? 'bg-green-500' :
                                    variant === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                                    }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            },
        },
        {
            header: 'Status',
            accessor: 'replicas',
            render: (row) => {
                const [ready, desired] = row.replicas.split('/').map(Number);
                if (ready === desired && desired > 0) {
                    return (
                        <div className="flex items-center space-x-1 text-green-400">
                            <CheckCircle size={14} />
                            <span className="text-xs">Healthy</span>
                        </div>
                    );
                } else if (ready === 0) {
                    return (
                        <div className="flex items-center space-x-1 text-red-400">
                            <AlertTriangle size={14} />
                            <span className="text-xs">Unavailable</span>
                        </div>
                    );
                } else {
                    return (
                        <div className="flex items-center space-x-1 text-yellow-400">
                            <Activity size={14} />
                            <span className="text-xs">Degraded</span>
                        </div>
                    );
                }
            },
        },
        {
            header: 'Age',
            accessor: 'age',
            render: (row) => (
                <span className="text-muted-foreground text-sm">{row.age}</span>
            ),
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
                <div className="text-sm text-muted-foreground">
                    Total: {filteredDeployments.length}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Total Deployments"
                    value={stats.total}
                    icon={Layers}
                    className="border-l-4 border-l-blue-500"
                />
                <StatsCard
                    title="Healthy"
                    value={stats.healthy}
                    icon={CheckCircle}
                    className="border-l-4 border-l-green-500"
                />
                <StatsCard
                    title="Degraded"
                    value={stats.degraded}
                    icon={AlertTriangle}
                    className="border-l-4 border-l-yellow-500"
                />
                <StatsCard
                    title="Updating"
                    value={stats.updating}
                    icon={Activity}
                    className="border-l-4 border-l-purple-500"
                />
            </div>

            {/* Namespace Filter */}
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    <Filter size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium">Namespace:</span>
                </div>
                <select
                    value={selectedNamespace}
                    onChange={(e) => setSelectedNamespace(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    style={{
                        colorScheme: 'dark'
                    }}
                >
                    <option value="all" className="bg-[#1a1f2e] text-white">All Namespaces</option>
                    {namespaces.map(ns => (
                        <option key={ns} value={ns} className="bg-[#1a1f2e] text-white">{ns}</option>
                    ))}
                </select>
            </div>

            {/* Deployments Table */}
            <div className="rounded-xl glass-card overflow-hidden">
                <Table
                    columns={columns}
                    data={filteredDeployments}
                    loading={loading}
                    onRowClick={(row) => navigate(`/deployments/${row.namespace}/${row.name}`)}
                />
            </div>
        </div>
    );
};

export default Deployments;
