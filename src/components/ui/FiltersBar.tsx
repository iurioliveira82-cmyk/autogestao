import React from 'react';
import { Filter } from 'lucide-react';
import { cn } from '../../utils';

interface FiltersBarProps {
  children: React.ReactNode;
  className?: string;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({ children, className }) => {
  return (
    <div className={cn("flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-sm", className)}>
      <div className="flex items-center gap-2 text-zinc-400">
        <Filter size={18} />
        <span className="text-xs font-black uppercase tracking-widest">Filtros:</span>
      </div>
      <div className="flex-1 flex items-center gap-4 overflow-x-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
};
