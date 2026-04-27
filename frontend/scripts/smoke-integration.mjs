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
const sidebarFile = resolve('src/layouts/Sidebar.tsx');
const lazyRoutesFile = resolve('src/routes/lazyRoutes.ts');
const jobDetailFile = resolve('src/pages/workloads/jobs/JobDetail.tsx');
const cronJobDetailFile = resolve('src/pages/workloads/jobs/CronJobDetail.tsx');
const resourcesFile = resolve('src/api/resources.ts');
const authApiFile = resolve('src/api/auth.ts');
const observationApiFile = resolve('src/api/observation.ts');
const dashboardFile = resolve('src/pages/dashboard/Dashboard.tsx');
const apiTypesFile = resolve('src/types/api.ts');
const backendRouterFile = resolve('../backend/internal/api/router.go');
const backendMainFile = resolve('../backend/cmd/server/main.go');
const backendHandlersFile = resolve('../backend/internal/api/handlers/handlers.go');
const viteConfigFile = resolve('vite.config.ts');

// 登录与路由保护基础链路
assertContains(appFile, /<ProtectedRoute>/, 'App routes must be protected');
assertContains(guardFile, /Navigate to="\/login"/, 'ProtectedRoute must redirect unauthenticated user');

// WS 必须通过 ticket，不允许 query token
assertNotContains(wsClientFile, /params\.set\('token'/, 'WebSocket query token must be removed');
assertContains(terminalFile, /\/ws\/tickets/, 'Terminal must request ws ticket before connect');

// ReplicaSet 用户路径必须完整可达
assertContains(appFile, /path="replicasets"/, 'App must expose ReplicaSets route');
assertContains(sidebarFile, /\/workloads\/replicasets/, 'Sidebar must expose ReplicaSets navigation');
assertContains(lazyRoutesFile, /ReplicaSets/, 'Lazy routes must register ReplicaSets');

// Job/CronJob 详情页不能再是占位页
assertNotContains(jobDetailFile, /功能开发中|此页面正在开发中/, 'Job detail must be implemented');
assertNotContains(cronJobDetailFile, /功能开发中|此页面正在开发中/, 'CronJob detail must be implemented');

// 后端默认端口和开发代理必须保持一致
assertContains(backendMainFile, /port = "9099"/, 'Backend default port must be 9099');
assertContains(viteConfigFile, /localhost:9099/g, 'Vite dev proxy must target backend default port 9099');

// 指标必须走 Kubernetes Metrics Server，不允许启动路径依赖 VictoriaMetrics
assertNotContains(backendMainFile, /VICTORIA_METRICS_URL|metrics\.NewClient/, 'Backend startup must not initialize VictoriaMetrics');
assertContains(backendHandlersFile, /metrics-server has no historical storage/, 'History metrics endpoints must return stable Metrics Server status');

// Alertmanager 默认关闭时首页不持续轮询告警摘要
assertContains(backendMainFile, /ALERTMANAGER_ENABLED/, 'Backend must expose Alertmanager enable switch');
assertContains(apiTypesFile, /enabled\?: boolean/, 'AlertSummary must include optional enabled flag');
assertContains(dashboardFile, /data\?\.enabled === false\) return false/, 'Dashboard must disable alert summary polling when Alertmanager is disabled');
assertContains(dashboardFile, /ALERTMANAGER_ENABLED=false/, 'Dashboard must render Alertmanager disabled state');

// 前端 API 封装必须有后端路由对应，避免可点击 404 和假能力
const groupPrefixes = {
  r: '',
  publicAPI: '/api/v1',
  v1: '/api/v1',
  clusterAdmin: '/api/v1/clusters',
  adminAPI: '/api/v1/admin',
  ws: '/ws',
};

function normalizeBackendPath(path) {
  let normalized = path.startsWith('/api/v1') ? path.slice('/api/v1'.length) : path;
  if (!normalized) normalized = '/';
  return normalized.replaceAll(/:\w+/g, '{param}');
}

function routeRegex(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return /^\/$/;
  const pattern = parts
    .map((part) => (part.startsWith('{') && part.endsWith('}') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^/${pattern}$`);
}

function extractBackendRoutes() {
  const router = readFileSync(backendRouterFile, 'utf8');
  const routes = [];
  const routePattern = /(\w+)\.(GET|POST|PUT|DELETE|PATCH)\("([^"]*)"/g;
  for (const match of router.matchAll(routePattern)) {
    const [, group, method, path] = match;
    const prefix = groupPrefixes[group];
    if (prefix === undefined) continue;
    const fullPath = `${prefix}${path}`.replaceAll(/\/{2,}/g, '/');
    if (fullPath.startsWith('/ws') || fullPath === '/health') continue;
    routes.push({
      method: method.toLowerCase(),
      path: normalizeBackendPath(fullPath),
    });
  }
  return routes.map((route) => ({
    ...route,
    regex: routeRegex(route.path),
  }));
}

function extractFrontendCalls(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const methodMap = {
    get: 'get',
    post: 'post',
    put: 'put',
    patch: 'patch',
    del: 'delete',
    putYaml: 'put',
  };
  const calls = [];
  const callPattern = /\b(get|post|put|patch|del|putYaml)<[^>]*>\((`[^`]+`|'[^']+'|"[^"]+")/g;
  for (const match of content.matchAll(callPattern)) {
    const [, helper, rawPath] = match;
    calls.push({
      method: methodMap[helper],
      path: rawPath.slice(1, -1).replaceAll(/\$\{[^}]+\}/g, '{param}'),
      filePath,
    });
  }
  return calls;
}

const backendRoutes = extractBackendRoutes();
const frontendCalls = [
  ...extractFrontendCalls(resourcesFile),
  ...extractFrontendCalls(authApiFile),
  ...extractFrontendCalls(observationApiFile),
];
const missingCalls = frontendCalls.filter(
  (call) => !backendRoutes.some((route) => route.method === call.method && route.regex.test(call.path))
);
if (missingCalls.length > 0) {
  const details = missingCalls.map((call) => `${call.method.toUpperCase()} ${call.path} (${call.filePath})`).join('\n');
  throw new Error(`Frontend API calls without backend routes:\n${details}`);
}

console.log('smoke integration checks passed');
