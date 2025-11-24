import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, Box, Terminal, FileText, AlertCircle, Edit } from 'lucide-react';
import Table from '../components/Table';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import LogViewer from '../components/LogViewer';
import TerminalComponent from '../components/Terminal';
import ResourceEditor from '../components/ResourceEditor';

const StatefulSetDetail = () => {
    const { namespace, name } = useParams();
    const navigate = useNavigate();
    const [statefulset, setStatefulSet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPod, setSelectedPod] = useState(null);
    const [showLogs, setShowLogs] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [showEditor, setShowEditor] = useState(false);

    const fetchData = async () => {
        try {
            const data = await fetch(`/api/v1/statefulsets/${namespace}/${name}`).then(res => res.json());
            setStatefulSet(data);
        } catch (error) {
            console.error('Failed to fetch statefulset details', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!statefulset) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">StatefulSet Not Found</h2>
                <button
                    onClick={() => navigate('/statefulsets')}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    Back to StatefulSets
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate('/statefulsets')}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Database className="w-8 h-8 text-blue-400" />
                            <h1 className="text-3xl font-bold tracking-tight">{statefulset.name}</h1>
                            <Badge variant="default">{statefulset.namespace}</Badge>
                        </div>
                        <button
                            onClick={() => setShowEditor(true)}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            <Edit size={16} />
                            <span>Edit</span>
                        </button>
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span>Replicas: {statefulset.replicas}</span>
                        <span>Age: {statefulset.age}</span>
                    </div>
                </div>
            </div>

            {/* Images */}
            {statefulset.images && statefulset.images.length > 0 && (
                <div className="rounded-xl glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Container Images</h3>
                    <div className="space-y-2">
                        {statefulset.images.map((image, idx) => (
                            <div key={idx} className="flex items-center space-x-2 text-sm">
                                <span className="text-muted-foreground font-mono">{image}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pods */}
            <div className="rounded-xl glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Pods ({statefulset.pods?.length || 0})</h3>
                <Table columns={podColumns} data={statefulset.pods || []} />
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

            {/* Resource Editor Modal */}
            <ResourceEditor
                isOpen={showEditor}
                onClose={() => setShowEditor(false)}
                type="statefulsets"
                namespace={namespace}
                name={name}
                onUpdate={fetchData}
            />
        </div>
    );
};

export default StatefulSetDetail;
