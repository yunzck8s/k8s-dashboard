# Kubernetes Dashboard Backend

Go backend for the Kubernetes Dashboard frontend.

## Prerequisites

- Go 1.21+ installed
- Access to a Kubernetes cluster
- Kubeconfig file at `~/.kube/config` (or specify with `--kubeconfig` flag)

## Installation

```bash
cd backend
go mod download
```

## Building

```bash
go build -o backend-server ./cmd/server
```

## Running

```bash
# Run the server (defaults to port 8080)
./backend-server

# Or with go run
go run cmd/server/main.go
```

The server will start on `http://localhost:8080` and automatically connect to your Kubernetes cluster using the kubeconfig.

## API Endpoints

- `GET /api/v1/cluster/stats` - Get cluster statistics
- `GET /api/v1/nodes` - List all nodes
- `GET /api/v1/pods` - List all pods
- `GET /api/v1/deployments` - List all deployments
- `GET /api/v1/services` - List all services

## Troubleshooting

If you encounter build errors related to dependencies:

```bash
# Clean and rebuild dependencies
go clean -modcache
go mod tidy
go build ./cmd/server
```

## Integration with Frontend

The Vite frontend is configured to proxy `/api/*` requests to `http://localhost:8080`. 

1. Start the backend: `./backend-server`
2. Start the frontend: `npm run dev` (in the parent directory)
3. Access the dashboard at `http://localhost:5173`
