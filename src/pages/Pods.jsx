import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { api } from '../services/api';

const Pods = () => {
    const navigate = useNavigate();
    const [pods, setPods] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const [selectedNamespace, setSelectedNamespace] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const namespaces = ['all', ...new Set(pods.map(p => p.namespace))];

    const filteredPods = selectedNamespace === 'all'
        ? pods
        : pods.filter(p => p.namespace === selectedNamespace);

    const totalPages = Math.ceil(filteredPods.length / itemsPerPage);
    const paginatedPods = filteredPods.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

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
                    <Box size={16} className="text-muted-foreground" />
                    <span className="font-medium">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'Namespace',
            accessor: 'namespace',
            render: (row) => (
                <span className="text-muted-foreground">{row.namespace}</span>
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
                <span className={row.restarts > 0 ? 'text-yellow-500' : ''}>
                    {row.restarts}
                </span>
            ),
        },
        {
            header: 'Age',
            accessor: 'age',
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Pods</h1>
                <div className="flex items-center space-x-4">
                    <select
                        value={selectedNamespace}
                        onChange={(e) => {
                            setSelectedNamespace(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="bg-card border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {namespaces.map(ns => (
                            <option key={ns} value={ns}>
                                {ns === 'all' ? 'All Namespaces' : ns}
                            </option>
                        ))}
                    </select>
                    <div className="text-sm text-muted-foreground">
                        Total: {filteredPods.length}
                    </div>
                </div>
            </div>

            <div className="rounded-xl glass-card overflow-hidden">
                <Table columns={columns} data={paginatedPods} loading={loading} onRowClick={handleRowClick} />

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                        <div className="text-sm text-muted-foreground">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPods.length)} of {filteredPods.length}
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Pods;
