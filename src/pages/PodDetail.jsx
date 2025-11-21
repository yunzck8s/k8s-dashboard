import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Box, Calendar, Server, Tag, AlertCircle, FileCode } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Badge from '../components/Badge';
import LogViewer from '../components/LogViewer';

const PodDetail = () => {
    const { namespace, name } = useParams();
    const navigate = useNavigate();
    const [pod, setPod] = useState(null);
    const [yaml, setYaml] = useState('');
    const [loading, setLoading] = useState(true);
    const [yamlLoading, setYamlLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

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

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'yaml') {
            fetchYaml();
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
                    {['overview', 'containers', 'volumes', 'logs', 'yaml', 'events'].map((tab) => (
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
                    <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                            <FileCode size={20} />
                            <span>YAML</span>
                        </h2>
                        {yamlLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            </div>
                        ) : yaml ? (
                            <div className="rounded-lg overflow-hidden">
                                <SyntaxHighlighter
                                    language="yaml"
                                    style={vscDarkPlus}
                                    customStyle={{
                                        margin: 0,
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                    }}
                                >
                                    {yaml}
                                </SyntaxHighlighter>
                            </div>
                        ) : (
                            <p className="text-muted-foreground">Failed to load YAML</p>
                        )}
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
        </div>
    );
};

export default PodDetail;
