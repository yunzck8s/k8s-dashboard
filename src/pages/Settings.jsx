import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <SettingsIcon size={32} className="text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            </div>

            <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">Dashboard Configuration</h2>
                <p className="text-muted-foreground mb-4">
                    Configure your Kubernetes Dashboard settings here.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Refresh Interval
                        </label>
                        <select className="w-full max-w-xs px-3 py-2 bg-background border border-border rounded-lg">
                            <option value="5">5 seconds</option>
                            <option value="10" selected>10 seconds</option>
                            <option value="30">30 seconds</option>
                            <option value="60">1 minute</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Theme
                        </label>
                        <select className="w-full max-w-xs px-3 py-2 bg-background border border-border rounded-lg">
                            <option value="dark" selected>Dark</option>
                            <option value="light">Light</option>
                            <option value="auto">Auto</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
