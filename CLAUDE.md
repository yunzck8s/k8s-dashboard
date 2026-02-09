# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kubernetes Dashboard - an enterprise K8s cluster management web UI with real-time monitoring, RBAC, audit logging, and multi-cluster support. Monorepo with a React/TypeScript frontend and Go backend.

## Common Commands

```bash
# Development (runs frontend on :5173 and backend on :8080 concurrently)
make dev
make dev-frontend    # frontend only
make dev-backend     # backend only

# Build
make build           # build both
make frontend        # frontend only (npm install + npm run build)
make backend         # backend only (go build -o bin/server ./cmd/server)

# Test
make test            # runs both: cd backend && go test ./... ; cd frontend && npm run test
cd backend && go test ./internal/api/...   # single Go package
cd frontend && npm test                     # frontend tests

# Lint
make lint            # runs golangci-lint (backend) and ESLint (frontend)
cd frontend && npm run lint
cd backend && golangci-lint run

# Format
make fmt             # go fmt + eslint --fix

# Docker
make docker                                          # build image
make docker IMAGE_NAME=my-registry/k8s-dashboard IMAGE_TAG=v1.0.0

# Deploy to K8s
make deploy          # applies rbac, deployment, service manifests
make undeploy
```

## Architecture

### Backend (`backend/`)

Go + Gin web framework. Entry point: `cmd/server/main.go`.

```
backend/internal/
├── api/
│   ├── router.go          # All route definitions (public, authenticated, admin, WebSocket)
│   ├── handlers/           # HTTP handlers - Handler struct holds all service clients
│   │   ├── handlers.go     # Main Handler with K8s resource CRUD (pods, deployments, etc.)
│   │   ├── auth.go         # AuthHandler for login, user management, approvals
│   │   └── observation.go  # ObservationHandler for cluster health analysis
│   └── middleware/          # Auth (JWT), audit logging, CORS, namespace access control
├── k8s/                    # client-go wrapper for K8s API access
├── auth/                   # JWT authentication, user/session management (PostgreSQL)
├── audit/                  # Audit logging to PostgreSQL
├── alerts/                 # Alert rules persistence (PostgreSQL)
├── alertmanager/           # Alertmanager HTTP client
├── metrics/                # VictoriaMetrics HTTP client
└── observation/            # Cluster observation service (anomaly detection, trends)
```

**Key patterns:**
- `Handler` struct in `handlers.go` is the main handler holding `k8s.Client`, `metrics.Client`, `alertmanager.Client`, `alerts.Service`, and `audit.Client`. All K8s resource handlers are methods on this struct.
- Authentication is optional - if PostgreSQL is unavailable, the backend runs without auth/audit (no-auth mode).
- Routes are split into three groups: public (`/api/v1/auth/login|logout`), authenticated (`/api/v1/*`), and admin (`/api/v1/admin/*` - requires admin role).
- WebSocket endpoints at `/ws/logs`, `/ws/exec`, `/ws/watch` for real-time log streaming, terminal access, and resource watches.
- The backend serves the built frontend static files from `./frontend/dist/` with a SPA fallback (NoRoute -> index.html).

**Environment variables:** `PORT` (8080), `VICTORIA_METRICS_URL`, `ALERTMANAGER_URL`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `TZ` (Asia/Shanghai).

### Frontend (`frontend/`)

React 19 + TypeScript + Vite. TailwindCSS for styling. Zustand for auth state, React Query for server state.

```
frontend/src/
├── api/
│   ├── client.ts          # Axios instance with JWT interceptor and X-Cluster header
│   ├── resources.ts       # K8s resource API calls
│   ├── auth.ts            # Auth API calls
│   └── observation.ts     # Observation API calls
├── store/auth.ts          # Zustand auth store (persisted to localStorage)
├── components/            # Shared components (ProtectedRoute, etc.)
├── layouts/MainLayout.tsx # Shell layout with sidebar navigation
├── pages/                 # Feature pages organized by K8s resource category
│   ├── workloads/         # pods/, deployments/, statefulsets/, daemonsets/, jobs/
│   ├── network/           # services/, ingresses/
│   ├── config/            # configmaps/, secrets/, storage/
│   ├── rbac/              # roles, clusterroles, bindings, serviceaccounts
│   ├── nodes/, namespaces/, clusters/, events/, alerts/, observation/, audit/
│   └── admin/             # users, approvals (admin-only)
└── App.tsx                # React Router routes, QueryClient setup
```

**Key patterns:**
- API client (`api/client.ts`) auto-attaches JWT token from localStorage and `X-Cluster` header for multi-cluster routing.
- 401 responses trigger automatic redirect to `/login`.
- Routing follows `/:category/:resource` pattern (e.g., `/workloads/pods`, `/network/services`). Detail pages use `/:category/:resource/:namespace/:name`.
- Role hierarchy: admin > operator > viewer. Namespace-level access control via `allowedNamespaces`.
- React Query default: `staleTime: 30000`, `retry: 1`, `refetchOnWindowFocus: false`.

### Dev Proxy

Vite dev server proxies `/api` to `http://localhost:8080` and `/ws` to `ws://localhost:8080` (configured in `vite.config.ts`).

### Deployment (`deploy/`)

- `docker/Dockerfile` - Multi-stage build: Node 20 (frontend) -> Go 1.25 (backend) -> Alpine 3.19 (runtime). Single container serves both.
- `kubernetes/` - Deployment, Service, Ingress, RBAC manifests for the `k8s-dashboard` namespace.
- `kustomize/` - Base + overlays (dev/prod) with PostgreSQL and VictoriaMetrics dependencies.

## Design System

"Mission Control" dark theme. See `DESIGN_SYSTEM.md` for full reference. Key points:
- Custom CSS component classes defined in `frontend/src/index.css` via `@layer components`: `btn`, `card`, `badge`, `input`, `table-container`, etc.
- Tailwind extended with `k8s` status colors (running/pending/failed/succeeded/unknown), `surface` background colors, and `primary` brand color.
- Use CSS variables (`--color-*`) for theme colors. Avoid hard-coded color values.
- Fonts: Fira Sans (UI), Fira Code (code/data). Configured in `tailwind.config.js`.

## API Pattern

REST API at `/api/v1`. Resources follow a consistent pattern:
- List all: `GET /api/v1/{resources}` (cluster-wide)
- List namespaced: `GET /api/v1/namespaces/:ns/{resources}`
- Get: `GET /api/v1/namespaces/:ns/{resources}/:name`
- Create: `POST /api/v1/namespaces/:ns/{resources}`
- Update: `PUT /api/v1/namespaces/:ns/{resources}/:name`
- Delete: `DELETE /api/v1/namespaces/:ns/{resources}/:name`
- YAML: `GET/PUT /api/v1/namespaces/:ns/{resources}/:name/yaml`
