import React from 'react';
import { cn } from '../../utils';
import { Search, Filter, X } from 'lucide-react';

interface FiltersToolbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  onClearFilters?: () => void;
  showClearFilters?: boolean;
}

const FiltersToolbar: React.FC<FiltersToolbarProps> = ({ 
  searchQuery, 
  onSearchChange, 
  searchPlaceholder = "Buscar...", 
  filters, 
  actions,
  className,
  onClearFilters,
  showClearFilters = false
}) => {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm",
      className
    )}>
      <div className="flex flex-1 items-center gap-4 min-w-0">
        {onSearchChange && (
          <div className="relative flex-1 max-w-md group">
            <Search 
              size={18} 
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-accent transition-colors" 
            />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all shadow-sm"
            />
          </div>
        )}

        {filters && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {filters}
          </div>
        )}

        {showClearFilters && onClearFilters && (
          <button 
            onClick={onClearFilters}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors shrink-0"
          >
            <X size={14} />
            Limpar
          </button>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default FiltersToolbar;
