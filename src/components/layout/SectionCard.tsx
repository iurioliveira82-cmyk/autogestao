import React from 'react';
import { cn } from '../../utils';

interface SectionCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ 
  children, 
  title, 
  subtitle, 
  actions, 
  className,
  noPadding = false
}) => {
  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-slate-100 dark:hover:shadow-slate-900/20",
      className
    )}>
      {(title || subtitle || actions) && (
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            {title && (
              <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={cn(
        !noPadding && "p-8",
        "relative"
      )}>
        {children}
      </div>
    </div>
  );
};

export default SectionCard;
