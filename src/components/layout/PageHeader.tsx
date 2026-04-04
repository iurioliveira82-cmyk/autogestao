import React from 'react';
import { cn } from '../../utils';
import { ChevronRight } from 'lucide-react';

interface Breadcrumb {
  label: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  breadcrumbs, 
  actions,
  className 
}) => {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 py-2", className)}>
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.label}>
                {index > 0 && <ChevronRight size={10} className="text-slate-300" />}
                <button 
                  onClick={crumb.onClick}
                  className={cn(
                    "hover:text-primary transition-colors",
                    !crumb.onClick && "cursor-default pointer-events-none"
                  )}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter font-display">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
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

export default PageHeader;
