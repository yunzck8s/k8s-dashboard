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

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Running':
                return 'success';
            case 'Pending':
                return 'warning';
            case 'Failed':
                return 'error';
            case 'Succeeded':
                return 'info';
            default:
                return 'default';
        }
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Pods</h1>
                <div className="text-sm text-muted-foreground">
                    Total: {pods.length}
                </div>
            </div>

            <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
                <Table columns={columns} data={pods} loading={loading} onRowClick={handleRowClick} />
            </div>
        </div>
    );
};

export default Pods;
