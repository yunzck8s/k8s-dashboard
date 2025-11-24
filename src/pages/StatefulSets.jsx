import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import FilterBar from '../components/FilterBar';
import ActionMenu from '../components/ActionMenu';
import { api } from '../services/api';

const StatefulSets = () => {
    const navigate = useNavigate();
    const [statefulsets, setStatefulSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNamespace, setSelectedNamespace] = useState('');

    const fetchStatefulSets = async () => {
        try {
            const data = await api.getStatefulSets();
            setStatefulSets(data);
        } catch (error) {
            console.error('Failed to fetch statefulsets', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatefulSets();
        const interval = setInterval(fetchStatefulSets, 10000);
        return () => clearInterval(interval);
    }, []);

    const namespaces = useMemo(() => {
        const ns = [...new Set(statefulsets.map(s => s.namespace))];
        return ns.sort();
    }, [statefulsets]);

    const filteredStatefulSets = useMemo(() => {
        return statefulsets.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.namespace.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesNamespace = !selectedNamespace || s.namespace === selectedNamespace;
            return matchesSearch && matchesNamespace;
        });
    }, [statefulsets, searchTerm, selectedNamespace]);

    const getRowActions = (row) => [
        {
            label: 'View Details',
            icon: 'yaml',
            onClick: () => navigate(`/statefulsets/${row.namespace}/${row.name}`)
        }
    ];

    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Database size={16} className="text-blue-400" />
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
            header: 'Replicas',
            accessor: 'replicas',
            render: (row) => {
                const [ready, desired] = row.replicas.split('/').map(Number);
                const isHealthy = ready === desired && desired > 0;
                return (
                    <span className={`font-medium ${isHealthy ? 'text-green-400' : 'text-yellow-400'}`}>
                        {row.replicas}
                    </span>
                );
            },
        },
        {
            header: 'Status',
            accessor: 'replicas',
            render: (row) => {
                const [ready, desired] = row.replicas.split('/').map(Number);
                if (ready === desired && desired > 0) {
                    return <Badge variant="success">Healthy</Badge>;
                } else if (ready === 0) {
                    return <Badge variant="error">Unavailable</Badge>;
                } else {
                    return <Badge variant="warning">Degraded</Badge>;
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
        {
            header: '',
            accessor: 'name',
            render: (row) => (
                <ActionMenu actions={getRowActions(row)} />
            ),
        },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 pb-4">
                <h1 className="text-3xl font-bold tracking-tight mb-1">StatefulSets</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your stateful applications
                </p>
            </div>

            <FilterBar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                namespaces={namespaces}
                selectedNamespace={selectedNamespace}
                onNamespaceChange={setSelectedNamespace}
                onRefresh={fetchStatefulSets}
                showCreate={false}
            />

            <div className="flex-1 overflow-auto p-6 pt-0">
                <div className="rounded-lg border border-white/10 overflow-hidden bg-black/20">
                    <Table
                        columns={columns}
                        data={filteredStatefulSets}
                        loading={loading}
                        onRowClick={(row) => navigate(`/statefulsets/${row.namespace}/${row.name}`)}
                    />
                </div>
            </div>
        </div>
    );
};

export default StatefulSets;
