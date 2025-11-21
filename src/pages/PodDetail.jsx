import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Box, Calendar, Server, Tag, AlertCircle, FileCode } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Badge from '../components/Badge';
import LogViewer from '../components/LogViewer';
import Terminal from '../components/Terminal';
import MetricsCharts from '../components/MetricsCharts';
import Editor from '@monaco-editor/react';
import { Save, X, Edit2, Activity } from 'lucide-react';

const PodDetail = () => {
    const { namespace, name } = useParams();
    const navigate = useNavigate();
    const [pod, setPod] = useState(null);
    const [yaml, setYaml] = useState('');
    const [loading, setLoading] = useState(true);
    const [yamlLoading, setYamlLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [showTerminal, setShowTerminal] = useState(false);
    const [terminalContainer, setTerminalContainer] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [modifiedYaml, setModifiedYaml] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [metrics, setMetrics] = useState([]);
    const [metricsLoading, setMetricsLoading] = useState(false);

    useEffect(() => {
        const fetchPodDetail = async () => {
            try {
                const response = await fetch(`/api/v1/pods/${namespace}/${name}`);
                if (!response.ok) throw new Error('Failed to fetch pod');
                const data = await response.json();
                setPod(data);
            } catch (error) {
                console.error('Failed to fetch pod detail', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPodDetail();
    }, [namespace, name]);

    const fetchYaml = async () => {
        if (yaml) return; // Already loaded
        setYamlLoading(true);
        try {
            const response = await fetch(`/api/v1/pods/${namespace}/${name}/yaml`);
            if (!response.ok) throw new Error('Failed to fetch YAML');
            const data = await response.json();
            setYaml(data.yaml);
        } catch (error) {
            console.error('Failed to fetch YAML', error);
        } finally {
            setYamlLoading(false);
        }
    };

    const fetchMetrics = async () => {
        setMetricsLoading(true);
        try {
            const response = await fetch(`/api/v1/pods/${namespace}/${name}/metrics`);
            if (!response.ok) throw new Error('Failed to fetch metrics');
            const data = await response.json();
            // Append new metric point
            setMetrics(prev => {
                const newPoint = {
                    timestamp: data.timestamp,
                    cpu: data.containers.reduce((acc, c) => acc + parseFloat(c.usage.cpu.replace('n', '')) / 1000000000, 0), // Convert nanocores to cores
                    memory: data.containers.reduce((acc, c) => acc + parseFloat(c.usage.memory.replace('Ki', '')) * 1024, 0) // Convert Ki to bytes
                };
                // Keep last 20 points
                return [...prev, newPoint].slice(-20);
            });
        } catch (error) {
            console.error('Failed to fetch metrics', error);
        } finally {
            setMetricsLoading(false);
        }
    };

    useEffect(() => {
        let interval;
        if (activeTab === 'metrics') {
            fetchMetrics();
            interval = setInterval(fetchMetrics, 5000);
        }
        return () => clearInterval(interval);
    }, [activeTab, namespace, name]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setIsEditing(false);
        if (tab === 'yaml') {
            fetchYaml();
        }
    };

    const handleSaveYaml = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`/api/v1/pods/${namespace}/${name}/yaml`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ yaml: modifiedYaml }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update YAML');
            }

            const data = await response.json();
            setYaml(data.yaml);
            setIsEditing(false);
            // You might want to show a success toast here
            alert('YAML updated successfully');
        } catch (error) {
            console.error('Failed to update YAML', error);
            alert(`Failed to update YAML: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!pod) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Pod not found</p>
            </div>
        );
    }

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Running':
                return 'success';
            case 'Pending':
                return 'warning';
            case 'Failed':
                return 'error';
            default:
                return 'default';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate('/pods')}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center space-x-3">
                        <Box size={24} className="text-primary" />
                        <h1 className="text-3xl font-bold tracking-tight">{pod.name}</h1>
                        <Badge variant={getStatusVariant(pod.status)}>{pod.status}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">
                        Namespace: {pod.namespace} • Node: {pod.nodeName}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
                <div className="flex space-x-6">
                    {['overview', 'containers', 'volumes', 'logs', 'yaml', 'metrics', 'events'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            className={`pb-3 px-1 border-b-2 transition-colors ${activeTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
                {activeTab === 'overview' && (
                    <>
                        {/* Metadata */}
                        <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                            <h2 className="text-xl font-semibold mb-4">Metadata</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Pod IP</p>
                                    <p className="font-medium">{pod.podIP || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Created At</p>
                                    <p className="font-medium">
                                        {new Date(pod.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Labels */}
                        {pod.labels && Object.keys(pod.labels).length > 0 && (
                            <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                                <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                                    <Tag size={20} />
                                    <span>Labels</span>
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(pod.labels).map(([key, value]) => (
                                        <span
                                            key={key}
                                            className="px-3 py-1 bg-muted rounded-full text-sm"
                                        >
                                            {key}: {value}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Conditions */}
                        {pod.conditions && pod.conditions.length > 0 && (
                            <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                                <h2 className="text-xl font-semibold mb-4">Conditions</h2>
                                <div className="space-y-2">
                                    {pod.conditions.map((condition, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium">{condition.type}</p>
                                                {condition.message && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {condition.message}
                                                    </p>
                                                )}
                                            </div>
                                            <Badge
                                                variant={
                                                    condition.status === 'True' ? 'success' : 'default'
                                                }
                                            >
                                                {condition.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'containers' && (
                    <div className="space-y-4">
                        {pod.containers.map((container, index) => (
                            <div
                                key={index}
                                className="rounded-xl bg-card border border-border shadow-sm p-6"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold">{container.name}</h3>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => {
                                                setTerminalContainer(container.name);
                                                setShowTerminal(true);
                                            }}
                                            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors flex items-center space-x-2"
                                        >
                                            <div className="w-4 h-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="4 17 10 11 4 5"></polyline>
                                                    <line x1="12" y1="19" x2="20" y2="19"></line>
                                                </svg>
                                            </div>
                                            <span>Terminal</span>
                                        </button>
                                        <Badge variant={container.ready ? 'success' : 'warning'}>
                                            {container.ready ? 'Ready' : 'Not Ready'}
                                        </Badge>
                                        <Badge variant="default">{container.status}</Badge>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Image</p>
                                        <p className="font-mono text-sm">{container.image}</p>
                                    </div>

                                    <div>
                                        <p className="text-sm text-muted-foreground">Restarts</p>
                                        <p>{container.restarts}</p>
                                    </div>

                                    {container.ports && container.ports.length > 0 && (
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                Ports
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {container.ports.map((port, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-1 bg-muted rounded text-sm"
                                                    >
                                                        {port.containerPort}/{port.protocol}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(container.resources.requests ||
                                        container.resources.limits) && (
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    Resources
                                                </p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {container.resources.requests && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">
                                                                Requests
                                                            </p>
                                                            {Object.entries(container.resources.requests).map(
                                                                ([key, value]) => (
                                                                    <p key={key} className="text-sm">
                                                                        {key}: {value}
                                                                    </p>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                    {container.resources.limits && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">
                                                                Limits
                                                            </p>
                                                            {Object.entries(container.resources.limits).map(
                                                                ([key, value]) => (
                                                                    <p key={key} className="text-sm">
                                                                        {key}: {value}
                                                                    </p>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'volumes' && (
                    <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                        <h2 className="text-xl font-semibold mb-4">Volumes</h2>
                        {pod.volumes && pod.volumes.length > 0 ? (
                            <div className="space-y-2">
                                {pod.volumes.map((volume, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                    >
                                        <p className="font-medium">{volume.name}</p>
                                        <Badge variant="default">{volume.type}</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No volumes</p>
                        )}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <LogViewer
                        namespace={pod.namespace}
                        podName={pod.name}
                        containers={pod.containers}
                    />
                )}

                {activeTab === 'yaml' && (
                    <div className="rounded-xl bg-card border border-border shadow-sm p-6 flex flex-col h-[600px]">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold flex items-center space-x-2">
                                <FileCode size={20} />
                                <span>YAML Configuration</span>
                            </h2>
                            <div className="flex items-center space-x-2">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-3 py-1.5 hover:bg-muted rounded-lg text-sm transition-colors flex items-center space-x-2"
                                            disabled={isSaving}
                                        >
                                            <X size={16} />
                                            <span>Cancel</span>
                                        </button>
                                        <button
                                            onClick={handleSaveYaml}
                                            disabled={isSaving}
                                            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors flex items-center space-x-2"
                                        >
                                            {isSaving ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            ) : (
                                                <Save size={16} />
                                            )}
                                            <span>Save Changes</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setModifiedYaml(yaml);
                                            setIsEditing(true);
                                        }}
                                        className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-sm transition-colors flex items-center space-x-2"
                                    >
                                        <Edit2 size={16} />
                                        <span>Edit YAML</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {yamlLoading ? (
                            <div className="flex items-center justify-center flex-1">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            </div>
                        ) : yaml ? (
                            <div className="flex-1 border border-border rounded-lg overflow-hidden">
                                <Editor
                                    height="100%"
                                    defaultLanguage="yaml"
                                    value={isEditing ? modifiedYaml : yaml}
                                    onChange={(value) => setModifiedYaml(value)}
                                    theme="vs-dark"
                                    options={{
                                        readOnly: !isEditing,
                                        minimap: { enabled: false },
                                        scrollBeyondLastLine: false,
                                        fontSize: 14,
                                        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                                    }}
                                />
                            </div>
                        ) : (
                            <p className="text-muted-foreground">Failed to load YAML</p>
                        )}
                    </div>
                )}

                {activeTab === 'metrics' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold flex items-center space-x-2">
                                <Activity size={20} />
                                <span>Live Metrics</span>
                            </h2>
                            <Badge variant="default">Auto-refresh: 5s</Badge>
                        </div>
                        <MetricsCharts metrics={metrics} />
                    </div>
                )}

                {activeTab === 'events' && (
                    <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                            <AlertCircle size={20} />
                            <span>Events</span>
                        </h2>
                        {pod.events && pod.events.length > 0 ? (
                            <div className="space-y-2">
                                {pod.events.map((event, index) => (
                                    <div
                                        key={index}
                                        className="p-3 bg-muted/50 rounded-lg"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <Badge
                                                variant={
                                                    event.type === 'Normal' ? 'success' : 'warning'
                                                }
                                            >
                                                {event.reason}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(event.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm">{event.message}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No events</p>
                        )}
                    </div>
                )}
            </div>

            {/* Terminal Modal */}
            {showTerminal && (
                <Terminal
                    namespace={pod.namespace}
                    podName={pod.name}
                    container={terminalContainer}
                    onClose={() => setShowTerminal(false)}
                />
            )}
        </div>
    );
};

export default PodDetail;
