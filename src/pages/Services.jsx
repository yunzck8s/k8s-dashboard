import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import { api } from '../services/api';

const Services = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

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
                    <Activity size={16} className="text-muted-foreground" />
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
            header: 'Type',
            accessor: 'type',
            render: (row) => (
                <Badge variant={getTypeVariant(row.type)}>{row.type}</Badge>
            ),
        },
        {
            header: 'Cluster IP',
            accessor: 'clusterIP',
        },
        {
            header: 'Ports',
            accessor: 'ports',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Services</h1>
                <div className="text-sm text-muted-foreground">
                    Total: {services.length}
                </div>
            </div>

            <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
                <Table columns={columns} data={services} loading={loading} />
            </div>
        </div>
    );
};

export default Services;
