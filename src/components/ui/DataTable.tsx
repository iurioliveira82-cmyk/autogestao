import React from 'react';
import { cn } from '../../utils';

interface Column<T> {
  header: string;
  accessor: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  headers?: string[];
  columns?: Column<T>[];
  data: T[];
  renderRow?: (item: T, index: number) => React.ReactNode;
  className?: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({ 
  headers, 
  columns,
  data = [], 
  renderRow, 
  className,
  isLoading,
  emptyMessage = "Nenhum registro encontrado."
}: DataTableProps<T>) {
  const tableHeaders = columns ? columns.map(col => col.header) : (headers || []);
  
  return (
    <div className={cn("w-full overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-sm", className)}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/80">
              {tableHeaders.map((header, i) => (
                <th 
                  key={i} 
                  className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 first:rounded-tl-2xl last:rounded-tr-2xl"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {tableHeaders.map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded-lg w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={tableHeaders.length} className="px-6 py-12 text-center text-slate-400 font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr 
                  key={index} 
                  className="group hover:bg-slate-50/50 transition-colors duration-150"
                >
                  {columns ? (
                    columns.map((col, colIndex) => (
                      <td key={colIndex} className={cn("px-6 py-4", col.className)}>
                        {col.accessor(item, index)}
                      </td>
                    ))
                  ) : renderRow ? (
                    renderRow(item, index)
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
