import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

const MetricsCharts = ({ metrics }) => {
    if (!metrics || metrics.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                No metrics data available
            </div>
        );
    }

    // Format data for charts
    // Assuming metrics is an array of { timestamp, cpu, memory }
    // CPU in cores (e.g., 0.1), Memory in MiB
    const data = metrics.map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString(),
        cpu: parseFloat(m.cpu),
        memory: parseFloat(m.memory) / (1024 * 1024), // Convert bytes to MiB
    }));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CPU Chart */}
            <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">CPU Usage (Cores)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                            <XAxis
                                dataKey="time"
                                stroke="#9ca3af"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#9ca3af"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value.toFixed(3)}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#e5e7eb' }}
                                labelStyle={{ color: '#9ca3af' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="cpu"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorCpu)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Memory Chart */}
            <div className="rounded-xl bg-card border border-border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Memory Usage (MiB)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                            <XAxis
                                dataKey="time"
                                stroke="#9ca3af"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#9ca3af"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${Math.round(value)}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#e5e7eb' }}
                                labelStyle={{ color: '#9ca3af' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="memory"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorMemory)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default MetricsCharts;
