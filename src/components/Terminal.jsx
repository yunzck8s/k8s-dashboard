import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { X, RefreshCw } from 'lucide-react';

const Terminal = ({ namespace, podName, container, onClose }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const wsRef = useRef(null);
    const fitAddonRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [command, setCommand] = useState('/bin/sh');

    useEffect(() => {
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

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Connect to WebSocket
        connectWebSocket(term);

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

        return () => {
            window.removeEventListener('resize', handleResize);
            if (wsRef.current) {
                wsRef.current.close();
            }
            term.dispose();
        };
    }, [namespace, podName, container, command]);

    const connectWebSocket = (term) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8080/api/v1/pods/${namespace}/${podName}/terminal?container=${container}&command=${command}`;

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
        if (xtermRef.current) {
            xtermRef.current.clear();
            connectWebSocket(xtermRef.current);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-[90%] h-[80%] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <h2 className="text-lg font-semibold">
                            Terminal - {podName} ({container})
                        </h2>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleReconnect}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                            title="Reconnect"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Terminal */}
                <div ref={terminalRef} className="flex-1 p-2 overflow-hidden" />
            </div>
        </div>
    );
};

export default Terminal;
