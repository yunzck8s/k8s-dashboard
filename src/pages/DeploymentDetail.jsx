import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, Box, Code, Edit, MoreVertical, Maximize2, RotateCw, Trash2, AlertTriangle, Settings } from 'lucide-react';
import Badge from '../components/Badge';
import Table from '../components/Table';
import Modal from '../components/Modal';
import LogViewer from '../components/LogViewer';
import TerminalComponent from '../components/Terminal';
import ResourceEditor from '../components/ResourceEditor';
import ConfigEditor from '../components/ConfigEditor';
import ReplicaWidget from '../components/ReplicaWidget';
import ActionMenu from '../components/ActionMenu';
import { api } from '../services/api';

const DeploymentDetail = () => {
    const { namespace, name } = useParams();
    const navigate = useNavigate();
    const [deployment, setDeployment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPod, setSelectedPod] = useState(null);
    const [showLogs, setShowLogs] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [showYamlEditor, setShowYamlEditor] = useState(false);
    const [showConfigEditor, setShowConfigEditor] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const fetchDeployment = async () => {
        try {
            const response = await fetch(`/api/v1/deployments/${namespace}/${name}`);
            const data = await response.json();
            setDeployment(data);
        } catch (error) {
            console.error('Failed to fetch deployment details', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeployment();
        const interval = setInterval(fetchDeployment, 5000);
        return () => clearInterval(interval);
    }, [namespace, name]);

    const handleScale = async (replicas) => {
        await api.scaleDeployment(namespace, name, replicas);
        await fetchDeployment();
    };

    const handleConfigUpdate = async (newConfig) => {
        // In a real implementation, we would diff and patch.
        // For now, we'll convert to YAML and update.
        // This requires a backend endpoint that accepts JSON or we convert client-side.
        // Assuming we have a way to update via JSON or we just use the existing YAML update.
        // For simplicity, we'll assume the backend can handle the update or we'd implement a proper patch.
        // Here we will just log it as a placeholder since we need a JSON update endpoint or YAML conversion.
        console.log('Updating config:', newConfig);
        // TODO: Implement actual update logic
        await fetchDeployment();
    };

    const handleRedeploy = async () => {
        try {
            await api.redeployDeployment(namespace, name);
            await fetchDeployment();
        } catch (error) {
            console.error('Failed to redeploy', error);
        }
    };

    const handleDelete = async () => {
        try {
            await api.deleteDeployment(namespace, name);
            navigate('/deployments');
        } catch (error) {
            console.error('Failed to delete', error);
        }
    };

    const podColumns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Box size={14} className="text-muted-foreground" />
                    <span className="font-medium text-sm">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => {
                const variant = row.status === 'Running' ? 'success' :
                    row.status.includes('Error') || row.status.includes('CrashLoop') ? 'error' : 'warning';
                return <Badge variant={variant}>{row.status}</Badge>;
            },
        },
        {
            header: 'Restarts',
            accessor: 'restarts',
            render: (row) => (
                <span className={row.restarts > 5 ? 'text-yellow-400' : 'text-muted-foreground'}>
                    {row.restarts}
                </span>
            ),
        },
        {
            header: 'Age',
            accessor: 'age',
            render: (row) => <span className="text-sm text-muted-foreground">{row.age}</span>,
        },
        {
            header: '',
            accessor: 'name',
            render: (row) => (
                <ActionMenu actions={[
                    { label: 'View Logs', icon: 'logs', onClick: () => { setSelectedPod(row); setShowLogs(true); } },
                    { label: 'Open Shell', icon: 'terminal', onClick: () => { setSelectedPod(row); setShowTerminal(true); } }
                ]} />
            ),
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!deployment) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold mb-2">Deployment Not Found</h2>
                <button
                    onClick={() => navigate('/deployments')}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                    Back to Deployments
                </button>
            </div>
        );
    }

    const headerActions = [
        {
            label: 'Edit Config',
            icon: 'edit',
            onClick: () => setShowConfigEditor(true)
        },
        {
            label: 'Edit YAML',
            icon: 'yaml',
            onClick: () => setShowYamlEditor(true)
        },
        {
            label: 'Redeploy',
            icon: 'terminal',
            onClick: handleRedeploy
        },
        {
            label: 'Delete',
            icon: 'delete',
            danger: true,
            onClick: () => setShowDeleteConfirm(true)
        }
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-black/20 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => navigate('/deployments')}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold">{deployment.name}</h1>
                            <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="default">{deployment.namespace}</Badge>
                                <span className="text-sm text-muted-foreground">• {deployment.age}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <ReplicaWidget
                            current={deployment.replicas?.ready || 0}
                            desired={deployment.replicas?.desired || 0}
                            onUpdate={handleScale}
                        />
                        <div className="h-8 w-px bg-white/10" />
                        <ActionMenu actions={headerActions} />
                    </div>
                </div>
            </div>

            {/* Content - Unified View */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Overview Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-black/20 border border-white/10">
                        <div className="text-xs text-muted-foreground mb-1">Strategy</div>
                        <div className="text-lg font-medium">{deployment.strategy}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-black/20 border border-white/10">
                        <div className="text-xs text-muted-foreground mb-1">Available</div>
                        <div className="text-lg font-medium">{deployment.replicas?.available || 0}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-black/20 border border-white/10">
                        <div className="text-xs text-muted-foreground mb-1">Updated</div>
                        <div className="text-lg font-medium">{deployment.replicas?.updated || 0}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-black/20 border border-white/10">
                        <div className="text-xs text-muted-foreground mb-1">Created</div>
                        <div className="text-lg font-medium">{new Date(deployment.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>

                {/* Pods Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Pods</h3>
                        <Badge variant="secondary">{deployment.pods?.length || 0} Total</Badge>
                    </div>
                    <div className="rounded-lg border border-white/10 overflow-hidden bg-black/20">
                        <Table columns={podColumns} data={deployment.pods || []} />
                    </div>
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={showLogs} onClose={() => setShowLogs(false)} title={`Logs - ${selectedPod?.name}`} size="full">
                {selectedPod && <LogViewer namespace={selectedPod.namespace} podName={selectedPod.name} />}
            </Modal>

            <Modal isOpen={showTerminal} onClose={() => setShowTerminal(false)} title={`Terminal - ${selectedPod?.name}`} size="full">
                {selectedPod && <TerminalComponent namespace={selectedPod.namespace} podName={selectedPod.name} />}
            </Modal>

            {/* Edit YAML (Pure) */}
            <ResourceEditor
                isOpen={showYamlEditor}
                onClose={() => setShowYamlEditor(false)}
                type="deployments"
                namespace={namespace}
                name={name}
                onUpdate={fetchDeployment}
            />

            {/* Edit Config (Form) */}
            <ConfigEditor
                isOpen={showConfigEditor}
                onClose={() => setShowConfigEditor(false)}
                deployment={deployment}
                onSave={handleConfigUpdate}
            />

            {/* Delete Confirmation */}
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Deployment" size="sm">
                <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                        <div className="flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                            <div className="text-sm text-red-200">
                                <p className="font-medium">This action cannot be undone</p>
                                <p className="mt-1">All pods will be terminated and the deployment will be permanently deleted.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
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
        </div>
    );
};

export default DeploymentDetail;
