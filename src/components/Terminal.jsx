import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { RefreshCw } from 'lucide-react';

const Terminal = ({ namespace, podName, container, onClose }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const wsRef = useRef(null);
    const fitAddonRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [command, setCommand] = useState('/bin/sh');
    const [podContainers, setPodContainers] = useState([]);
    const [selectedContainer, setSelectedContainer] = useState(container || '');

    // Fetch pod details if container not provided
    useEffect(() => {
        if (!container) {
            fetch(`/api/v1/pods/${namespace}/${podName}`)
                .then(res => res.json())
                .then(data => {
                    if (data.containers) {
                        setPodContainers(data.containers);
                        if (!selectedContainer && data.containers.length > 0) {
                            setSelectedContainer(data.containers[0].name);
                        }
                    }
                })
                .catch(err => console.error('Failed to fetch pod details:', err));
        } else {
            // If container is provided via props, use it
            setSelectedContainer(container);
            setPodContainers([{ name: container }]);
        }
    }, [namespace, podName, container]);

    useEffect(() => {
        if (!selectedContainer) return;

        // Initialize xterm.js
        const term = new XTerm({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#1e1e1e',
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
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);

        // Clear previous terminal if exists
        if (terminalRef.current) {
            terminalRef.current.innerHTML = '';
        }

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Connect to WebSocket
        connectWebSocket(term, selectedContainer);

        // Handle resize
        const handleResize = () => {
            fitAddon.fit();
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'resize',
                    rows: term.rows,
                    cols: term.cols,
                }));
            }
        };

        window.addEventListener('resize', handleResize);

        // Initial fit
        setTimeout(() => fitAddon.fit(), 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (wsRef.current) {
                wsRef.current.close();
            }
            term.dispose();
        };
    }, [namespace, podName, selectedContainer, command]);

    const connectWebSocket = (term, currentContainer) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8080/api/v1/pods/${namespace}/${podName}/terminal?container=${currentContainer}&command=${command}`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setIsConnected(true);
            term.writeln('\x1b[32mConnected to container terminal\x1b[0m');
            term.writeln('');
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'stdout' || message.type === 'stderr') {
                term.write(message.data);
            } else if (message.type === 'error') {
                term.writeln(`\x1b[31m[ERROR] ${message.data}\x1b[0m`);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            term.writeln('\x1b[31m[ERROR] WebSocket connection failed\x1b[0m');
            setIsConnected(false);
        };

        ws.onclose = () => {
            setIsConnected(false);
            term.writeln('');
            term.writeln('\x1b[33m[INFO] Connection closed\x1b[0m');
        };

        // Handle terminal input
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'stdin',
                    data: data,
                }));
            }
        });

        wsRef.current = ws;
    };

    const handleReconnect = () => {
        if (wsRef.current) {
            wsRef.current.close();
        }
        if (xtermRef.current && selectedContainer) {
            xtermRef.current.clear();
            connectWebSocket(xtermRef.current, selectedContainer);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Controls */}
            <div className="flex-shrink-0 bg-card border-b border-border p-2">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-muted-foreground">
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>

                    <div className="h-4 w-px bg-border" />

                    {/* Container Selector */}
                    {podContainers.length > 1 && (
                        <div className="flex items-center space-x-2">
                            <label className="text-xs font-medium text-muted-foreground">Container:</label>
                            <select
                                value={selectedContainer}
                                onChange={(e) => setSelectedContainer(e.target.value)}
                                className="bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                {podContainers.map(c => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center space-x-2">
                        <label className="text-xs font-medium text-muted-foreground">Shell:</label>
                        <select
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            className="bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="/bin/sh">/bin/sh</option>
                            <option value="/bin/bash">/bin/bash</option>
                            <option value="/bin/zsh">/bin/zsh</option>
                            <option value="sh">sh</option>
                            <option value="bash">bash</option>
                        </select>
                    </div>

                    <button
                        onClick={handleReconnect}
                        className="flex items-center space-x-1 px-2 py-1 bg-muted text-muted-foreground hover:bg-muted/80 rounded text-xs transition-colors"
                        title="Reconnect"
                    >
                        <RefreshCw size={14} />
                        <span>Reconnect</span>
                    </button>
                </div>
            </div>

            {/* Terminal */}
            <div className="flex-1 bg-[#1e1e1e] p-2 min-h-0 overflow-hidden relative">
                <div ref={terminalRef} className="h-full w-full" />
            </div>
        </div>
    );
};

export default Terminal;
