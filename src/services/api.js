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
    }
};
