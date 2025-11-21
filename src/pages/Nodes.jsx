import React, { useEffect, useState } from 'react';
import { Server } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { api } from '../services/api';

const Nodes = () => {
    const [nodes, setNodes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNodes = async () => {
            try {
                const data = await api.getNodes();
                setNodes(data);
            } catch (error) {
                console.error('Failed to fetch nodes', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNodes();
        const interval = setInterval(fetchNodes, 10000); // Refresh every 10s
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
            header: 'CPU',
            accessor: 'cpu',
        },
        {
            header: 'Memory',
            accessor: 'memory',
        },
        {
            header: 'Version',
            accessor: 'version',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Nodes</h1>
                <div className="text-sm text-muted-foreground">
                    Total: {nodes.length}
                </div>
            </div>

            <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
                <Table columns={columns} data={nodes} loading={loading} />
            </div>
        </div>
    );
};

export default Nodes;
