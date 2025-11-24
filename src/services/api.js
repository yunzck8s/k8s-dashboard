// API service for Kubernetes Dashboard
const API_BASE = '/api/v1';

export const api = {
    getClusterStats: async () => {
        const response = await fetch(`${API_BASE}/cluster/stats`);
        if (!response.ok) throw new Error('Failed to fetch cluster stats');
        return response.json();
    },

    getNodes: async () => {
        const response = await fetch(`${API_BASE}/nodes`);
        if (!response.ok) throw new Error('Failed to fetch nodes');
        return response.json();
    },

    getNodeDetail: async (name) => {
        const response = await fetch(`${API_BASE}/nodes/${name}`);
        if (!response.ok) throw new Error('Failed to fetch node details');
        return response.json();
    },

    getPods: async () => {
        const response = await fetch(`${API_BASE}/pods`);
        if (!response.ok) throw new Error('Failed to fetch pods');
        return response.json();
    },

    getDeployments: async () => {
        const response = await fetch(`${API_BASE}/deployments`);
        if (!response.ok) throw new Error('Failed to fetch deployments');
        return response.json();
    },

    getServices: async () => {
        const response = await fetch(`${API_BASE}/services`);
        if (!response.ok) throw new Error('Failed to fetch services');
        return response.json();
    },

    getAllNodeMetrics: async () => {
        const response = await fetch(`${API_BASE}/metrics/nodes`);
        if (!response.ok) throw new Error('Failed to fetch node metrics');
        return response.json();
    },

    getNodeMetrics: async (name) => {
        const response = await fetch(`${API_BASE}/nodes/${name}/metrics`);
        if (!response.ok) throw new Error('Failed to fetch node metrics');
        return response.json();
    },

    getStatefulSets: async () => {
        const response = await fetch(`${API_BASE}/statefulsets`);
        if (!response.ok) throw new Error('Failed to fetch statefulsets');
        return response.json();
    },

    getStatefulSetDetail: async (namespace, name) => {
        const response = await fetch(`${API_BASE}/statefulsets/${namespace}/${name}`);
        if (!response.ok) throw new Error('Failed to fetch statefulset details');
        return response.json();
    },

    getDaemonSets: async () => {
        const response = await fetch(`${API_BASE}/daemonsets`);
        if (!response.ok) throw new Error('Failed to fetch daemonsets');
        return response.json();
    },

    getDaemonSetDetail: async (namespace, name) => {
        const response = await fetch(`${API_BASE}/daemonsets/${namespace}/${name}`);
        if (!response.ok) throw new Error('Failed to fetch daemonset details');
        return response.json();
    },

    getResourceYaml: async (type, namespace, name) => {
        const response = await fetch(`${API_BASE}/${type}/${namespace}/${name}/yaml`);
        if (!response.ok) throw new Error('Failed to fetch resource YAML');
        return response.json();
    },

    updateResourceYaml: async (type, namespace, name, yaml) => {
        const response = await fetch(`${API_BASE}/${type}/${namespace}/${name}/yaml`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ yaml }),
        });
        if (!response.ok) throw new Error('Failed to update resource YAML');
        return response.json();
    },

    scaleDeployment: async (namespace, name, replicas) => {
        const response = await fetch(`${API_BASE}/deployments/${namespace}/${name}/scale`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ replicas }),
        });
        if (!response.ok) throw new Error('Failed to scale deployment');
        return response.json();
    },

    redeployDeployment: async (namespace, name) => {
        const response = await fetch(`${API_BASE}/deployments/${namespace}/${name}/redeploy`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to redeploy');
        return response.json();
    },

    deleteDeployment: async (namespace, name) => {
        const response = await fetch(`${API_BASE}/deployments/${namespace}/${name}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete deployment');
        return response.json();
    },

    scaleStatefulSet: async (namespace, name, replicas) => {
        const response = await fetch(`${API_BASE}/statefulsets/${namespace}/${name}/scale`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ replicas }),
        });
        if (!response.ok) throw new Error('Failed to scale statefulset');
        return response.json();
    },

    deleteStatefulSet: async (namespace, name) => {
        const response = await fetch(`${API_BASE}/statefulsets/${namespace}/${name}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete statefulset');
        return response.json();
    },

    deleteDaemonSet: async (namespace, name) => {
        const response = await fetch(`${API_BASE}/daemonsets/${namespace}/${name}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete daemonset');
        return response.json();
    }
};
