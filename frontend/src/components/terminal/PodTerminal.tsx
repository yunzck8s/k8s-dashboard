import { useCallback, useEffect, useRef, useState } from 'react';
import { api, createWebSocket } from '../../api';

interface PodTerminalProps {
  namespace: string;
  name: string;
  container: string;
}

export default function PodTerminal({ namespace, name, container }: PodTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const onDataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSocket = useCallback(
    async (terminal: import('xterm').Terminal) => {
      if (wsRef.current) {
        wsRef.current.close();
      }

      let ticket = '';
      try {
        const cluster = localStorage.getItem('currentCluster') || 'default';
        const response = await api.post<{ ticket: string }>('/ws/tickets', {
          action: 'exec',
          namespace,
          name,
          container,
          cluster,
        });
        ticket = response.data.ticket;
      } catch {
        setConnected(false);
        setError('获取终端票据失败');
        terminal.writeln('\x1b[1;31m获取终端票据失败\x1b[0m');
        return;
      }

      const ws = createWebSocket('/ws/exec', { ticket });
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        terminal.writeln('\x1b[1;32m已连接\x1b[0m');
        terminal.writeln('');
      };

      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          void event.data.text().then((text) => {
            terminal.write(text);
          });
          return;
        }
        terminal.write(event.data as string);
      };

      ws.onerror = () => {
        setError('连接失败');
        terminal.writeln('\x1b[1;31m连接失败\x1b[0m');
      };

      ws.onclose = () => {
        setConnected(false);
        terminal.writeln('\x1b[1;33m\r\n连接已断开\x1b[0m');
      };

      onDataDisposableRef.current?.dispose();
      onDataDisposableRef.current = terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    },
    [container, name, namespace]
  );

  useEffect(() => {
    if (!terminalRef.current || !container) {
      return;
    }

    let disposed = false;

    const setupTerminal = async () => {
      await import('xterm/css/xterm.css');

      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import('xterm'),
        import('xterm-addon-fit'),
        import('xterm-addon-web-links'),
      ]);

      if (disposed || !terminalRef.current) {
        return;
      }

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e293b',
          foreground: '#e2e8f0',
          cursor: '#f8fafc',
          cursorAccent: '#1e293b',
          selectionBackground: 'rgba(59, 130, 246, 0.3)',
          black: '#1e293b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f8fafc',
          brightBlack: '#475569',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(terminalRef.current);
      fitAddon.fit();

      terminalInstance.current = terminal;
      fitAddonRef.current = fitAddon;

      terminal.writeln('\x1b[1;34m正在连接到容器...\x1b[0m');
      terminal.writeln(`\x1b[90mNamespace: ${namespace}\x1b[0m`);
      terminal.writeln(`\x1b[90mPod: ${name}\x1b[0m`);
      terminal.writeln(`\x1b[90mContainer: ${container}\x1b[0m`);
      terminal.writeln('');

      void openSocket(terminal);

      const handleResize = () => {
        fitAddonRef.current?.fit();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };

    let removeResizeListener: (() => void) | undefined;
    void setupTerminal().then((cleanup) => {
      removeResizeListener = cleanup;
    });

    return () => {
      disposed = true;
      removeResizeListener?.();
      onDataDisposableRef.current?.dispose();
      onDataDisposableRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      terminalInstance.current?.dispose();
      terminalInstance.current = null;
      fitAddonRef.current = null;
      setConnected(false);
    };
  }, [container, name, namespace, openSocket]);

  const reconnect = () => {
    const terminal = terminalInstance.current;
    if (!terminal) {
      return;
    }

    setError(null);
    terminal.clear();
    terminal.writeln('\x1b[1;34m正在重新连接...\x1b[0m');
    void openSocket(terminal);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-surface-secondary border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-text-muted">{connected ? '已连接' : '未连接'}</span>
          <span className="text-sm text-text-muted">|</span>
          <span className="text-sm text-text-muted">{container}</span>
        </div>
        <button
          onClick={reconnect}
          className="px-3 py-1 text-sm bg-surface-tertiary text-text-secondary rounded hover:bg-surface-tertiary transition-colors"
          aria-label="重新连接终端"
        >
          重新连接
        </button>
      </div>

      <div ref={terminalRef} className="flex-1 bg-surface-tertiary p-2" style={{ minHeight: '400px' }} />

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
