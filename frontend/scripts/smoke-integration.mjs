import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function assertContains(filePath, pattern, message) {
  const content = readFileSync(filePath, 'utf8');
  if (!pattern.test(content)) {
    throw new Error(`${message}: ${filePath}`);
  }
}

function assertNotContains(filePath, pattern, message) {
  const content = readFileSync(filePath, 'utf8');
  if (pattern.test(content)) {
    throw new Error(`${message}: ${filePath}`);
  }
}

const appFile = resolve('src/App.tsx');
const guardFile = resolve('src/components/auth/ProtectedRoute.tsx');
const wsClientFile = resolve('src/api/client.ts');
const terminalFile = resolve('src/components/terminal/PodTerminal.tsx');

// 登录与路由保护基础链路
assertContains(appFile, /<ProtectedRoute>/, 'App routes must be protected');
assertContains(guardFile, /Navigate to="\/login"/, 'ProtectedRoute must redirect unauthenticated user');

// WS 必须通过 ticket，不允许 query token
assertNotContains(wsClientFile, /params\.set\('token'/, 'WebSocket query token must be removed');
assertContains(terminalFile, /\/ws\/tickets/, 'Terminal must request ws ticket before connect');

console.log('smoke integration checks passed');
