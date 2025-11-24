import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import FilterBar from '../components/FilterBar';
import ActionMenu from '../components/ActionMenu';
import { api } from '../services/api';

const DaemonSets = () => {
    const navigate = useNavigate();
    const [daemonsets, setDaemonSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNamespace, setSelectedNamespace] = useState('');

    const fetchDaemonSets = async () => {
        try {
            const data = await api.getDaemonSets();
            setDaemonSets(data);
        } catch (error) {
            console.error('Failed to fetch daemonsets', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDaemonSets();
        const interval = setInterval(fetchDaemonSets, 10000);
        return () => clearInterval(interval);
    }, []);

    const namespaces = useMemo(() => {
        const ns = [...new Set(daemonsets.map(d => d.namespace))];
        return ns.sort();
    }, [daemonsets]);

    const filteredDaemonSets = useMemo(() => {
        return daemonsets.filter(d => {
            const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.namespace.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesNamespace = !selectedNamespace || d.namespace === selectedNamespace;
            return matchesSearch && matchesNamespace;
        });
    }, [daemonsets, searchTerm, selectedNamespace]);

    const getRowActions = (row) => [
        {
            label: 'View Details',
            icon: 'yaml',
            onClick: () => navigate(`/daemonsets/${row.namespace}/${row.name}`)
        }
    ];

    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Grid size={16} className="text-purple-400" />
                    <span className="font-medium">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'Namespace',
            accessor: 'namespace',
            render: (row) => (
                <span className="text-xs px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {row.namespace}
                </span>
            ),
        },
        {
            header: 'Desired',
            accessor: 'desired',
            render: (row) => (
                <span className="text-muted-foreground text-sm">{row.desired}</span>
            ),
        },
        {
            header: 'Current',
            accessor: 'current',
            render: (row) => (
                <span className="text-muted-foreground text-sm">{row.current}</span>
            ),
        },
        {
            header: 'Ready',
            accessor: 'ready',
            render: (row) => (
                <span className="text-green-400 text-sm font-medium">{row.ready}</span>
            ),
        },
        {
            header: 'Status',
            accessor: 'ready',
            render: (row) => {
                const isHealthy = row.ready === row.desired;
                return isHealthy ?
                    <Badge variant="success">Healthy</Badge> :
                    <Badge variant="warning">Degraded</Badge>;
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
                <h1 className="text-3xl font-bold tracking-tight mb-1">DaemonSets</h1>
                <p className="text-sm text-muted-foreground">
                    Manage daemon pods across cluster nodes
                </p>
            </div>

            <FilterBar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                namespaces={namespaces}
                selectedNamespace={selectedNamespace}
                onNamespaceChange={setSelectedNamespace}
                onRefresh={fetchDaemonSets}
                showCreate={false}
            />

            <div className="flex-1 overflow-auto p-6 pt-0">
                <div className="rounded-lg border border-white/10 overflow-hidden bg-black/20">
                    <Table
                        columns={columns}
                        data={filteredDaemonSets}
                        loading={loading}
                        onRowClick={(row) => navigate(`/daemonsets/${row.namespace}/${row.name}`)}
                    />
                </div>
            </div>
        </div>
    );
};

export default DaemonSets;
