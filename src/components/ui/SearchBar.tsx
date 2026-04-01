import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../utils';

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onClear, className, ...props }) => {
  return (
    <div className="relative w-full max-w-xl">
      <div className={cn(
        "flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 px-4 py-3 rounded-2xl border border-border group focus-within:ring-4 focus-within:ring-accent/5 focus-within:border-accent/30 transition-all duration-300",
        className
      )}>
        <Search size={18} className="text-zinc-400 group-focus-within:text-accent transition-colors" />
        <input 
          type="text" 
          className="bg-transparent border-none outline-none text-sm font-medium w-full text-zinc-900 placeholder:text-zinc-500"
          {...props}
        />
        {props.value && onClear && (
          <button onClick={onClear} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
