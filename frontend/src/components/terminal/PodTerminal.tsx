import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { createWebSocket } from '../../api';

interface PodTerminalProps {
  namespace: string;
  name: string;
  container: string;
}

export default function PodTerminal({ namespace, name, container }: PodTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current || !container) return;

    // 创建终端实例
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e293b',
        foreground: '#e2e8f0',
        cursor: '#f8fafc',
        cursorAccent: '#1e293b',
        selection: 'rgba(59, 130, 246, 0.3)',
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

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    term.loadAddon(fit);
    term.loadAddon(webLinks);
    term.open(terminalRef.current);
    fit.fit();

    terminalInstance.current = term;
    fitAddon.current = fit;

    // 写入欢迎信息
    term.writeln('\x1b[1;34m正在连接到容器...\x1b[0m');
    term.writeln(`\x1b[90mNamespace: ${namespace}\x1b[0m`);
    term.writeln(`\x1b[90mPod: ${name}\x1b[0m`);
    term.writeln(`\x1b[90mContainer: ${container}\x1b[0m`);
    term.writeln('');

    // 建立 WebSocket 连接
    const wsUrl = `/ws/exec?namespace=${namespace}&name=${name}&container=${container}`;
    const ws = createWebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      term.writeln('\x1b[1;32m已连接\x1b[0m');
      term.writeln('');
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.text().then((text) => {
          term.write(text);
        });
      } else {
        term.write(event.data);
      }
    };

    ws.onerror = () => {
      setError('连接失败');
      term.writeln('\x1b[1;31m连接失败\x1b[0m');
    };

    ws.onclose = () => {
      setConnected(false);
      term.writeln('\x1b[1;33m\r\n连接已断开\x1b[0m');
    };

    // 处理终端输入
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // 处理窗口大小变化
    const handleResize = () => {
      fit.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [namespace, name, container]);

  // 重新连接
  const reconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setError(null);

    if (!terminalRef.current || !container) return;

    const term = terminalInstance.current;
    if (!term) return;

    term.clear();
    term.writeln('\x1b[1;34m正在重新连接...\x1b[0m');

    const wsUrl = `/ws/exec?namespace=${namespace}&name=${name}&container=${container}`;
    const ws = createWebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      term.writeln('\x1b[1;32m已连接\x1b[0m');
      term.writeln('');
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.text().then((text) => {
          term.write(text);
        });
      } else {
        term.write(event.data);
      }
    };

    ws.onerror = () => {
      setError('连接失败');
      term.writeln('\x1b[1;31m连接失败\x1b[0m');
    };

    ws.onclose = () => {
      setConnected(false);
      term.writeln('\x1b[1;33m\r\n连接已断开\x1b[0m');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* 状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-slate-400">
            {connected ? '已连接' : '未连接'}
          </span>
          <span className="text-sm text-slate-500">|</span>
          <span className="text-sm text-slate-400">{container}</span>
        </div>
        <button
          onClick={reconnect}
          className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
        >
          重新连接
        </button>
      </div>

      {/* 终端容器 */}
      <div
        ref={terminalRef}
        className="flex-1 bg-slate-900 p-2"
        style={{ minHeight: '400px' }}
      />

      {/* 错误提示 */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
