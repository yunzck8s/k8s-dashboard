import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Box, Activity, AlertCircle, Clock, Image as ImageIcon, Terminal, FileText } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import LogViewer from '../components/LogViewer';
import TerminalComponent from '../components/Terminal';

const DeploymentDetail = () => {
    const { namespace, name } = useParams();
    const navigate = useNavigate();
    const [deployment, setDeployment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPod, setSelectedPod] = useState(null);
    const [showLogs, setShowLogs] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);

    useEffect(() => {
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

        fetchDeployment();
        const interval = setInterval(fetchDeployment, 5000);
        return () => clearInterval(interval);
    }, [namespace, name]);

    const handleViewLogs = (pod) => {
        setSelectedPod(pod);
        setShowLogs(true);
    };

    const handleOpenShell = (pod) => {
        setSelectedPod(pod);
        setShowTerminal(true);
    };

    const podColumns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Box size={14} className="text-muted-foreground" />
                    <button
                        onClick={() => navigate(`/pods/${row.namespace}/${row.name}`)}
                        className="font-medium text-sm text-blue-400 hover:text-blue-300 hover:underline"
                    >
                        {row.name}
                    </button>
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
            header: 'Actions',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleViewLogs(row);
                        }}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-blue-400 hover:text-blue-300"
                        title="View Logs"
                    >
                        <FileText size={16} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenShell(row);
                        }}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-green-400 hover:text-green-300"
                        title="Open Shell"
                    >
                        <Terminal size={16} />
                    </button>
                </div>
            ),
        },
    ];

    const rsColumns = [
        {
            header: 'Name',
            accessor: 'name',
            render: (row) => (
                <div className="flex items-center space-x-2">
                    <Layers size={14} className="text-muted-foreground" />
                    <span className="font-medium text-sm">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'Replicas',
            accessor: 'replicas',
        },
        {
            header: 'Age',
            accessor: 'age',
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
                <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Deployment Not Found</h2>
                <button
                    onClick={() => navigate('/deployments')}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    Back to Deployments
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate('/deployments')}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">{deployment.name}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Namespace: <span className="text-blue-400">{deployment.namespace}</span>
                    </p>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="rounded-xl glass-card p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Desired Replicas</span>
                        <Activity className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-3xl font-bold">{deployment.replicas.desired}</div>
                </div>
                <div className="rounded-xl glass-card p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Ready Replicas</span>
                        <Box className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-3xl font-bold text-green-400">{deployment.replicas.ready}</div>
                </div>
                <div className="rounded-xl glass-card p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Available</span>
                        <Activity className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-3xl font-bold">{deployment.replicas.available}</div>
                </div>
                <div className="rounded-xl glass-card p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Updated</span>
                        <Activity className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="text-3xl font-bold">{deployment.replicas.updated}</div>
                </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Details</h3>
                    <div className="space-y-3">
                        <div className="flex items-start">
                            <ImageIcon className="w-4 h-4 mr-2 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <div className="text-xs text-muted-foreground">Image</div>
                                <div className="text-sm font-mono break-all">{deployment.image}</div>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Activity className="w-4 h-4 mr-2 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <div className="text-xs text-muted-foreground">Strategy</div>
                                <div className="text-sm">{deployment.strategy}</div>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Clock className="w-4 h-4 mr-2 mt-1 text-muted-foreground" />
                            <div className="flex-1">
                                <div className="text-xs text-muted-foreground">Created</div>
                                <div className="text-sm">{new Date(deployment.createdAt).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Labels</h3>
                    <div className="flex flex-wrap gap-2">
                        {deployment.labels && Object.entries(deployment.labels).map(([key, value]) => (
                            <span key={key} className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                                {key}: {value}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Pods */}
            <div className="rounded-xl glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Pods ({deployment.pods?.length || 0})</h3>
                {deployment.pods && deployment.pods.length > 0 ? (
                    <Table columns={podColumns} data={deployment.pods} />
                ) : (
                    <div className="text-center text-muted-foreground py-8">No pods found</div>
                )}
            </div>

            {/* ReplicaSets */}
            <div className="rounded-xl glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">ReplicaSets</h3>
                {deployment.replicaSets && deployment.replicaSets.length > 0 ? (
                    <Table columns={rsColumns} data={deployment.replicaSets} />
                ) : (
                    <div className="text-center text-muted-foreground py-8">No ReplicaSets found</div>
                )}
            </div>

            {/* Events */}
            <div className="rounded-xl glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Events</h3>
                {deployment.events && deployment.events.length > 0 ? (
                    <div className="space-y-2">
                        {deployment.events.slice(0, 10).map((event, idx) => (
                            <div key={idx} className="flex items-start space-x-3 p-3 rounded-lg bg-white/5">
                                <AlertCircle className={`w-4 h-4 mt-0.5 ${event.type === 'Warning' ? 'text-yellow-400' : 'text-blue-400'}`} />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium">{event.reason}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(event.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{event.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-8">No events found</div>
                )}
            </div>

            {/* Logs Modal */}
            <Modal
                isOpen={showLogs}
                onClose={() => setShowLogs(false)}
                title={`Logs - ${selectedPod?.name}`}
                size="full"
            >
                {selectedPod && (
                    <LogViewer
                        namespace={selectedPod.namespace}
                        podName={selectedPod.name}
                    />
                )}
            </Modal>

            {/* Terminal Modal */}
            <Modal
                isOpen={showTerminal}
                onClose={() => setShowTerminal(false)}
                title={`Terminal - ${selectedPod?.name}`}
                size="full"
            >
                {selectedPod && (
                    <TerminalComponent
                        namespace={selectedPod.namespace}
                        podName={selectedPod.name}
                    />
                )}
            </Modal>
        </div>
    );
};

export default DeploymentDetail;
