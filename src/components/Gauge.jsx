import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const Gauge = ({ value, title, color = "#3b82f6" }) => {
    const data = [
        { name: 'value', value: value },
        { name: 'rest', value: 100 - value },
    ];

    const cx = 150; // Center of the 300px wide chart
    const cy = 150;
    const iR = 80;
    const oR = 110;

    const needle = (value, cx, cy, iR, oR, color) => {
        const total = 100;
        const RADIAN = Math.PI / 180;
        const ang = 180.0 * (1 - value / total);
        const length = (iR + 2 * oR) / 3;
        const sin = Math.sin(-RADIAN * ang);
        const cos = Math.cos(-RADIAN * ang);
        const r = 5;
        const x0 = cx;
        const y0 = cy;
        const xba = x0 + r * sin;
        const yba = y0 - r * cos;
        const xbb = x0 - r * sin;
        const ybb = y0 + r * cos;
        const xp = x0 + length * cos;
        const yp = y0 + length * sin;

        return [
            <circle key="circle" cx={x0} cy={y0} r={r} fill={color} stroke="none" />,
            <path key="path" d={`M${xba} ${yba}L${xbb} ${ybb} L${xp} ${yp} L${xba} ${yba}`} stroke="none" fill={color} />,
        ];
    };

    return (
        <div className="p-6 rounded-xl glass-card flex flex-col items-center justify-center h-[280px] relative overflow-hidden group hover:bg-white/5 transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <h3 className="text-lg font-semibold mb-2 text-muted-foreground z-10">{title}</h3>

            <div className="relative flex items-center justify-center">
                <PieChart width={300} height={180}>
                    <Pie
                        dataKey="value"
                        startAngle={180}
                        endAngle={0}
                        data={data}
                        cx={cx}
                        cy={cy}
                        innerRadius={iR}
                        outerRadius={oR}
                        fill="#8884d8"
                        stroke="none"
                        paddingAngle={0}
                    >
                        <Cell fill={color} />
                        <Cell fill="rgba(255,255,255,0.05)" />
                    </Pie>
                    {needle(value, cx, cy, iR, oR, color)}
                </PieChart>

                <div className="absolute bottom-0 left-0 right-0 text-center z-10 translate-y-1">
                    <span className="text-4xl font-bold tracking-tighter" style={{ color: color }}>{value.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
};



export default Gauge;
