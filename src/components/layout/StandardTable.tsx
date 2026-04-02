import React from 'react';
import { cn } from '../../utils';
import { ChevronRight, MoreVertical } from 'lucide-react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
  width?: string;
}

interface StandardTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  loading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}

const StandardTable = <T extends { id: string | number }>({ 
  columns, 
  data, 
  onRowClick, 
  actions,
  loading = false,
  emptyState,
  className
}: StandardTableProps<T>) => {
  return (
    <div className={cn(
      "w-full overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm",
      className
    )}>
      <table className="w-full border-collapse text-left min-w-[800px]">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            {columns.map((col, index) => (
              <th 
                key={index}
                className={cn(
                  "px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400",
                  col.className
                )}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
            {actions && <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {columns.map((_, j) => (
                  <td key={j} className="px-8 py-6">
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-full" />
                  </td>
                ))}
                {actions && <td className="px-8 py-6"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-8 ml-auto" /></td>}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-8 py-20 text-center">
                {emptyState || (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-sm font-bold text-slate-400">Nenhum registro encontrado</p>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr 
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "group transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-900/50",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((col, index) => (
                  <td 
                    key={index}
                    className={cn(
                      "px-8 py-6 text-sm font-bold text-slate-600 dark:text-slate-300 transition-colors group-hover:text-slate-800 dark:group-hover:text-white",
                      col.className
                    )}
                  >
                    {typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as React.ReactNode)}
                  </td>
                ))}
                {actions && (
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                      {actions(item)}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StandardTable;
