import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Maximize2, RotateCw, Trash2, Eye, AlertTriangle } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import FilterBar from '../components/FilterBar';
import ActionMenu from '../components/ActionMenu';
import ConfigEditor from '../components/ConfigEditor';
import ResourceEditor from '../components/ResourceEditor';
import Modal from '../components/Modal';
import { api } from '../services/api';

const Deployments = () => {
    const navigate = useNavigate();
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNamespace, setSelectedNamespace] = useState('');

    // Modal states
    const [selectedDeployment, setSelectedDeployment] = useState(null);
    const [showConfigEditor, setShowConfigEditor] = useState(false);
    const [showYamlEditor, setShowYamlEditor] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    useEffect(() => {
        fetchDeployments();
        const interval = setInterval(fetchDeployments, 10000);
        return () => clearInterval(interval);
    }, []);

    const namespaces = useMemo(() => {
        const ns = [...new Set(deployments.map(d => d.namespace))];
        return ns.sort();
    }, [deployments]);

    const filteredDeployments = useMemo(() => {
        return deployments.filter(d => {
            const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.namespace.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesNamespace = !selectedNamespace || d.namespace === selectedNamespace;
            return matchesSearch && matchesNamespace;
        });
    }, [deployments, searchTerm, selectedNamespace]);

    const handleConfigUpdate = async (newConfig) => {
        // Placeholder for update logic
        console.log('Updating config:', newConfig);
        await fetchDeployments();
    };

    const handleRedeploy = async (deployment) => {
        try {
            await api.redeployDeployment(deployment.namespace, deployment.name);
            await fetchDeployments();
        } catch (error) {
            console.error('Failed to redeploy', error);
        }
    };

    const handleDelete = async () => {
        if (!selectedDeployment) return;
        try {
            await api.deleteDeployment(selectedDeployment.namespace, selectedDeployment.name);
            await fetchDeployments();
            setShowDeleteConfirm(false);
            setSelectedDeployment(null);
        } catch (error) {
            console.error('Failed to delete', error);
        }
    };

    const getRowActions = (row) => [
        {
            label: 'View Details',
            icon: 'yaml',
            onClick: () => navigate(`/deployments/${row.namespace}/${row.name}`)
        },
        {
            label: 'Edit Config',
            icon: 'edit',
            onClick: () => {
                setSelectedDeployment(row);
                setShowConfigEditor(true);
            }
        },
        {
            label: 'Redeploy',
            icon: 'terminal',
            onClick: () => handleRedeploy(row)
        },
        {
            label: 'Edit YAML',
            icon: 'yaml',
            onClick: () => {
                setSelectedDeployment(row);
                setShowYamlEditor(true);
            }
        },
        {
            label: 'Delete',
            icon: 'delete',
            danger: true,
            onClick: () => {
                setSelectedDeployment(row);
                setShowDeleteConfirm(true);
            }
        }
    ];

    const columns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Layers size={16} className="text-blue-400" />
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
                    <div className="flex items-center space-x-2">
                        <span className={`font-medium ${isHealthy ? 'text-green-400' : 'text-yellow-400'}`}>
                            {row.replicas}
                        </span>
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
                <h1 className="text-3xl font-bold tracking-tight mb-1">Deployments</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your application deployments
                </p>
            </div>

            <FilterBar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                namespaces={namespaces}
                selectedNamespace={selectedNamespace}
                onNamespaceChange={setSelectedNamespace}
                onRefresh={fetchDeployments}
                showCreate={false}
            />

            <div className="flex-1 overflow-auto p-6 pt-0">
                <div className="rounded-lg border border-white/10 overflow-hidden bg-black/20">
                    <Table
                        columns={columns}
                        data={filteredDeployments}
                        loading={loading}
                        onRowClick={(row) => navigate(`/deployments/${row.namespace}/${row.name}`)}
                    />
                </div>
            </div>

            {/* Config Editor */}
            {selectedDeployment && (
                <ConfigEditor
                    isOpen={showConfigEditor}
                    onClose={() => {
                        setShowConfigEditor(false);
                        setSelectedDeployment(null);
                    }}
                    deployment={selectedDeployment}
                    onSave={handleConfigUpdate}
                />
            )}

            {/* Edit YAML Modal */}
            {selectedDeployment && (
                <ResourceEditor
                    isOpen={showYamlEditor}
                    onClose={() => {
                        setShowYamlEditor(false);
                        setSelectedDeployment(null);
                    }}
                    type="deployments"
                    namespace={selectedDeployment.namespace}
                    name={selectedDeployment.name}
                    onUpdate={fetchDeployments}
                />
            )}

            {/* Delete Confirmation Modal */}
            {selectedDeployment && (
                <Modal
                    isOpen={showDeleteConfirm}
                    onClose={() => {
                        setShowDeleteConfirm(false);
                        setSelectedDeployment(null);
                    }}
                    title="Delete Deployment"
                    size="sm"
                >
                    <div className="space-y-4">
                        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                                <div className="text-sm text-red-200">
                                    <p className="font-medium">This action cannot be undone</p>
                                    <p className="mt-1">
                                        Deployment <span className="font-mono font-bold">{selectedDeployment.name}</span> and all its pods will be permanently deleted.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setSelectedDeployment(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                                Delete Deployment
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Deployments;
