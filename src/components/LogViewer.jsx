import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Download, Play, Pause, Trash2, Search } from 'lucide-react';

const LogViewer = ({ namespace, podName, containers }) => {
    const [logs, setLogs] = useState([]);
    const [follow, setFollow] = useState(true);
    const [tailLines, setTailLines] = useState(100);
    const [timestamps, setTimestamps] = useState(false);
    const [selectedContainer, setSelectedContainer] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [podContainers, setPodContainers] = useState(containers || []);
    const wsRef = useRef(null);
    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);

    // Fetch pod details if containers not provided
    useEffect(() => {
        if (!containers) {
            fetch(`/api/v1/pods/${namespace}/${podName}`)
                .then(res => res.json())
                .then(data => {
                    if (data.containers) {
                        setPodContainers(data.containers);
                    }
                })
                .catch(err => console.error('Failed to fetch pod details:', err));
        }
    }, [namespace, podName, containers]);

    useEffect(() => {
        // Set default container
        if (podContainers && podContainers.length > 0 && !selectedContainer) {
            setSelectedContainer(podContainers[0].name);
        }
    }, [podContainers, selectedContainer]);

    useEffect(() => {
        if (!selectedContainer) return;

        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [selectedContainer, follow, tailLines, timestamps]);

    useEffect(() => {
        if (follow && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, follow]);

    const connectWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8080/api/v1/pods/${namespace}/${podName}/logs?container=${selectedContainer}&follow=${follow}&tailLines=${tailLines}&timestamps=${timestamps}`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setIsConnected(true);
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'log') {
                setLogs(prev => [...prev, message.data]);
            } else if (message.type === 'error') {
                setLogs(prev => [...prev, `[ERROR] ${message.data}\n`]);
            } else if (message.type === 'close') {
                setLogs(prev => [...prev, `[INFO] ${message.data}\n`]);
                setIsConnected(false);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setLogs(prev => [...prev, '[ERROR] WebSocket connection failed\n']);
            setIsConnected(false);
        };

        ws.onclose = () => {
            setIsConnected(false);
            console.log('WebSocket disconnected');
        };

        wsRef.current = ws;
    };

    const handleClearLogs = () => {
        setLogs([]);
    };

    const handleDownloadLogs = () => {
        const logText = logs.join('');
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${podName}-${selectedContainer}-logs.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const filteredLogs = searchTerm
        ? logs.filter(log => log.toLowerCase().includes(searchTerm.toLowerCase()))
        : logs;

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="rounded-xl bg-card border border-border shadow-sm p-4">
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Container Selector */}
                    {podContainers && podContainers.length > 1 && (
                        <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium">Container:</label>
                            <select
                                value={selectedContainer}
                                onChange={(e) => setSelectedContainer(e.target.value)}
                                className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                {podContainers.map(container => (
                                    <option key={container.name} value={container.name}>
                                        {container.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Tail Lines */}
                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">Lines:</label>
                        <select
                            value={tailLines}
                            onChange={(e) => setTailLines(Number(e.target.value))}
                            className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={500}>500</option>
                            <option value={1000}>1000</option>
                            <option value={0}>All</option>
                        </select>
                    </div>

                    {/* Follow Toggle */}
                    <button
                        onClick={() => setFollow(!follow)}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${follow
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        {follow ? <Pause size={16} /> : <Play size={16} />}
                        <span>{follow ? 'Following' : 'Paused'}</span>
                    </button>

                    {/* Timestamps Toggle */}
                    <button
                        onClick={() => setTimestamps(!timestamps)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${timestamps
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        Timestamps
                    </button>

                    {/* Clear Logs */}
                    <button
                        onClick={handleClearLogs}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg text-sm transition-colors"
                    >
                        <Trash2 size={16} />
                        <span>Clear</span>
                    </button>

                    {/* Download Logs */}
                    <button
                        onClick={handleDownloadLogs}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg text-sm transition-colors"
                    >
                        <Download size={16} />
                        <span>Download</span>
                    </button>

                    {/* Connection Status */}
                    <div className="flex items-center space-x-2 ml-auto">
                        <div
                            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                                }`}
                        />
                        <span className="text-sm text-muted-foreground">
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-4 flex items-center space-x-2">
                    <Search size={16} className="text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Logs Display */}
            <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center space-x-2">
                    <Terminal size={16} />
                    <span className="text-sm font-medium">Logs</span>
                </div>
                <div
                    ref={logsContainerRef}
                    className="p-4 bg-black text-green-400 font-mono text-xs overflow-auto"
                    style={{ minHeight: '400px', maxHeight: '70vh' }}
                >
                    {filteredLogs.length === 0 ? (
                        <div className="text-muted-foreground">No logs available</div>
                    ) : (
                        filteredLogs.map((log, index) => (
                            <div key={index} className="whitespace-pre-wrap break-all">
                                {log}
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};

export default LogViewer;
