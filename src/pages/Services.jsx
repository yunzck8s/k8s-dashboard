import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Globe, Network } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import FilterBar from '../components/FilterBar';
import { api } from '../services/api';

const Services = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNamespace, setSelectedNamespace] = useState('');

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const data = await api.getServices();
                setServices(data);
            } catch (error) {
                console.error('Failed to fetch services', error);
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
        const interval = setInterval(fetchServices, 10000);
        return () => clearInterval(interval);
    }, []);

    const namespaces = useMemo(() => {
        const ns = [...new Set(services.map(s => s.namespace))];
        return ns.sort();
    }, [services]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.namespace.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesNamespace = !selectedNamespace || s.namespace === selectedNamespace;
            return matchesSearch && matchesNamespace;
        });
    }, [services, searchTerm, selectedNamespace]);

    const getTypeVariant = (type) => {
        switch (type) {
            case 'LoadBalancer':
                return 'info';
            case 'NodePort':
                return 'warning';
            case 'ClusterIP':
                return 'default';
            default:
                return 'default';
        }
    };

    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Activity size={16} className="text-purple-400" />
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
            header: 'Type',
            accessor: 'type',
            render: (row) => (
                <Badge variant={getTypeVariant(row.type)}>{row.type}</Badge>
            ),
        },
        {
            header: 'Cluster IP',
            accessor: 'clusterIP',
            render: (row) => <span className="text-sm text-muted-foreground font-mono">{row.clusterIP}</span>,
        },
        {
            header: 'Ports',
            accessor: 'ports',
            render: (row) => <span className="text-sm text-muted-foreground">{row.ports}</span>,
        },
    ];

    // Calculate stats
    const loadBalancers = services.filter(s => s.type === 'LoadBalancer').length;
    const nodePorts = services.filter(s => s.type === 'NodePort').length;
    const clusterIPs = services.filter(s => s.type === 'ClusterIP').length;

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Services</h1>
                    <p className="text-sm text-muted-foreground mt-1">Network service management</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Network size={20} className="text-purple-400" />
                        </div>
                        <span className="text-2xl font-bold">{services.length}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Total Services</div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Globe size={20} className="text-blue-400" />
                        </div>
                        <span className="text-2xl font-bold text-blue-400">{loadBalancers}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">LoadBalancer</div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <Network size={20} className="text-orange-400" />
                        </div>
                        <span className="text-2xl font-bold text-orange-400">{nodePorts}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">NodePort</div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="p-2 bg-gray-500/20 rounded-lg">
                            <Activity size={20} className="text-gray-400" />
                        </div>
                        <span className="text-2xl font-bold text-gray-400">{clusterIPs}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">ClusterIP</div>
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

            {/* Services Table */}
            <div className="flex-1 overflow-auto">
                <div className="rounded-xl border border-white/10 overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50">
                    <Table columns={columns} data={filteredServices} loading={loading} />
                </div>
            </div>
        </div>
    );
};

export default Services;
