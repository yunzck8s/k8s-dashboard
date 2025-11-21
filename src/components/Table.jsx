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
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-border">
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
                            className={`border-b border-border transition-colors ${onRowClick ? 'hover:bg-muted/50 cursor-pointer' : 'hover:bg-muted/30'
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
