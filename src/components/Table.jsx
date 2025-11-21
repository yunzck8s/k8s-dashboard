import React from 'react';

const Table = ({ columns, data, loading, onRowClick }) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                No data available
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl glass-card">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-white/5 bg-white/5">
                        {columns.map((column, index) => (
                            <th
                                key={index}
                                className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground"
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            onClick={() => onRowClick && onRowClick(row)}
                            className={`border-b border-white/5 transition-all duration-200 ${onRowClick ? 'hover:bg-white/5 cursor-pointer' : 'hover:bg-white/5'
                                }`}
                        >
                            {columns.map((column, colIndex) => (
                                <td key={colIndex} className="py-3 px-4 text-sm">
                                    {column.render ? column.render(row) : row[column.accessor]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
