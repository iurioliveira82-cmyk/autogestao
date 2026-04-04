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
      "flex flex-col items-center justify-center py-20 px-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-500",
      className
    )}>
      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-700 mb-6">
        <Icon size={32} />
      </div>
      
      <div className="space-y-1.5 max-w-sm mb-8">
        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter font-display">
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
