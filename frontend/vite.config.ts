import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: {
      polyfill: false,
    },
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');

          if (!normalizedId.includes('/node_modules/')) {
            return;
          }

          if (normalizedId.includes('/@monaco-editor/') || normalizedId.includes('/monaco-editor/')) {
            return 'editor-vendor';
          }
          if (normalizedId.includes('/xterm')) {
            return 'terminal-vendor';
          }
          if (normalizedId.includes('/recharts/') || normalizedId.includes('/d3-')) {
            return 'charts-vendor';
          }
          if (normalizedId.includes('/@tanstack/react-query/') || normalizedId.includes('/axios/')) {
            return 'data-vendor';
          }
          if (normalizedId.includes('/@headlessui/') || normalizedId.includes('/@heroicons/')) {
            return 'ui-vendor';
          }
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
});
