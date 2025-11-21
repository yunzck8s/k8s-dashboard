import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { api } from '../services/api';

const Deployments = () => {
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);

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
                <span className="text-muted-foreground">{row.namespace}</span>
            ),
        },
        {
            header: 'Replicas',
            accessor: 'replicas',
            render: (row) => {
                const [ready, desired] = row.replicas.split('/').map(Number);
                const variant = ready === desired ? 'success' : 'warning';
                return <Badge variant={variant}>{row.replicas}</Badge>;
            },
        },
        {
            header: 'Age',
            accessor: 'age',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
                <div className="text-sm text-muted-foreground">
                    Total: {deployments.length}
                </div>
            </div>

            <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
                <Table columns={columns} data={deployments} loading={loading} />
            </div>
        </div>
    );
};

export default Deployments;
