import React from 'react';
import { cn } from '../../utils';

interface SectionCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  headerAction?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ 
  children, 
  title, 
  subtitle, 
  actions, 
  headerAction,
  icon,
  className,
  noPadding = false
}) => {
  const displayActions = actions || headerAction;

  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden transition-all duration-300",
      className
    )}>
      {(title || subtitle || displayActions || icon) && (
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400">
                {icon}
              </div>
            )}
            <div className="space-y-0.5">
              {title && (
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-widest text-[13px]">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {displayActions && (
            <div className="flex items-center gap-2">
              {displayActions}
            </div>
          )}
        </div>
      )}
      <div className={cn(
        !noPadding && "p-6",
        "relative"
      )}>
        {children}
      </div>
    </div>
  );
};

export default SectionCard;
