import React from 'react';
import { cn } from '../../utils';
import { LucideIcon, Search } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon: Icon = Search, 
  title, 
  description, 
  action,
  className 
}) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-24 px-8 text-center bg-slate-50 dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-700",
      className
    )}>
      <div className="w-24 h-24 bg-white dark:bg-slate-950 rounded-[2rem] flex items-center justify-center text-slate-300 dark:text-slate-700 shadow-sm mb-8 rotate-3 group-hover:rotate-0 transition-all duration-700 ease-out">
        <Icon size={40} className="group-hover:scale-110 transition-transform duration-700" />
      </div>
      
      <div className="space-y-2 max-w-sm mb-10">
        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
          {title}
        </h3>
        {description && (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
