import React, { useEffect, useState, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Download, Play, Pause, Trash2, Search, Terminal as TerminalIcon } from 'lucide-react';

const LogViewer = ({ namespace, podName, containers }) => {
    const [follow, setFollow] = useState(true);
    const [tailLines, setTailLines] = useState(100);
    const [timestamps, setTimestamps] = useState(false);
    const [selectedContainer, setSelectedContainer] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [podContainers, setPodContainers] = useState(containers || []);

    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const wsRef = useRef(null);

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

    // Initialize xterm.js
    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#0f1419',
                foreground: '#d4d4d4',
                cursor: '#ffffff',
                selection: '#264f78',
                black: '#000000',
                red: '#cd3131',
                green: '#0dbc79',
                yellow: '#e5e510',
                blue: '#2472c8',
                magenta: '#bc3fbc',
                cyan: '#11a8cd',
                white: '#e5e5e5',
                brightBlack: '#666666',
                brightRed: '#f14c4c',
                brightGreen: '#23d18b',
                brightYellow: '#f5f543',
                brightBlue: '#3b8eea',
                brightMagenta: '#d670d6',
                brightCyan: '#29b8db',
                brightWhite: '#e5e5e5',
            },
            convertEol: true, // Important for proper line endings
            disableStdin: true, // Read-only for logs
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Handle resize
        const handleResize = () => {
            fitAddon.fit();
        };

        window.addEventListener('resize', handleResize);

        // Initial fit after a small delay to ensure container is rendered
        setTimeout(() => fitAddon.fit(), 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            term.dispose();
        };
    }, []);

    // Connect WebSocket
    useEffect(() => {
        if (!selectedContainer || !xtermRef.current) return;

        const term = xtermRef.current;
        term.clear();
        term.writeln('\x1b[33mConnecting to log stream...\x1b[0m');

        if (wsRef.current) {
            wsRef.current.close();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8080/api/v1/pods/${namespace}/${podName}/logs?container=${selectedContainer}&follow=${follow}&tailLines=${tailLines}&timestamps=${timestamps}`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setIsConnected(true);
            term.clear(); // Clear connecting message
            term.writeln('\x1b[32mSuccessfully connected to log stream.\x1b[0m');
            term.writeln('\x1b[90m----------------------------------------\x1b[0m');
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'log') {
                term.write(message.data);
                // xterm handles scrolling automatically if at bottom
            } else if (message.type === 'error') {
                term.writeln(`\x1b[31m[ERROR] ${message.data}\x1b[0m`);
            } else if (message.type === 'close') {
                term.writeln(`\x1b[33m[INFO] ${message.data}\x1b[0m`);
                setIsConnected(false);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            term.writeln('\x1b[31m[ERROR] WebSocket connection failed\x1b[0m');
            setIsConnected(false);
        };

        ws.onclose = () => {
            setIsConnected(false);
            term.writeln('\x1b[33m[INFO] Log stream disconnected\x1b[0m');
        };

        wsRef.current = ws;

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [selectedContainer, follow, tailLines, timestamps, namespace, podName]);

    const handleClearLogs = () => {
        if (xtermRef.current) {
            xtermRef.current.clear();
        }
    };

    const handleDownloadLogs = () => {
        if (!xtermRef.current) return;

        // Select all and get selection is a workaround, but xterm doesn't expose full buffer easily as string
        // A better way is to iterate the buffer
        const buffer = xtermRef.current.buffer.active;
        let logText = '';
        for (let i = 0; i < buffer.length; i++) {
            logText += buffer.getLine(i).translateToString(true) + '\n';
        }

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

    return (
        <div className="flex flex-col h-full w-full">
            {/* Controls */}
            <div className="flex-shrink-0 bg-card border-b border-border p-2">
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Container Selector */}
                    {podContainers && podContainers.length > 1 && (
                        <div className="flex items-center space-x-2">
                            <label className="text-xs font-medium text-muted-foreground">Container:</label>
                            <select
                                value={selectedContainer}
                                onChange={(e) => setSelectedContainer(e.target.value)}
                                className="px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
                        <label className="text-xs font-medium text-muted-foreground">Lines:</label>
                        <select
                            value={tailLines}
                            onChange={(e) => setTailLines(Number(e.target.value))}
                            className="px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={500}>500</option>
                            <option value={1000}>1000</option>
                            <option value={0}>All</option>
                        </select>
                    </div>

                    <div className="h-4 w-px bg-border mx-1" />

                    {/* Follow Toggle */}
                    <button
                        onClick={() => setFollow(!follow)}
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${follow
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        {follow ? <Pause size={14} /> : <Play size={14} />}
                        <span>{follow ? 'Following' : 'Paused'}</span>
                    </button>

                    {/* Timestamps Toggle */}
                    <button
                        onClick={() => setTimestamps(!timestamps)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${timestamps
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        Timestamps
                    </button>

                    <div className="flex-1" />

                    {/* Clear Logs */}
                    <button
                        onClick={handleClearLogs}
                        className="flex items-center space-x-1 px-2 py-1 bg-muted text-muted-foreground hover:bg-muted/80 rounded text-xs transition-colors"
                    >
                        <Trash2 size={14} />
                        <span>Clear</span>
                    </button>

                    {/* Download Logs */}
                    <button
                        onClick={handleDownloadLogs}
                        className="flex items-center space-x-1 px-2 py-1 bg-muted text-muted-foreground hover:bg-muted/80 rounded text-xs transition-colors"
                    >
                        <Download size={14} />
                        <span>Download</span>
                    </button>

                    {/* Connection Status */}
                    <div className="flex items-center space-x-2 ml-2 border-l border-border pl-2">
                        <div
                            className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                                }`}
                        />
                        <span className="text-xs text-muted-foreground">
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Logs Display (xterm.js) */}
            <div className="flex-1 bg-[#0f1419] p-0 min-h-0 overflow-hidden relative">
                <div ref={terminalRef} className="h-full w-full" />
            </div>
        </div>
    );
};

export default LogViewer;
