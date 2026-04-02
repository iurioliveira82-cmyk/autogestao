import React from 'react';
import { cn } from '../../utils';
import { X } from 'lucide-react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'modern' | 'glass';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'modern',
  ...props
}) => {
  const variants = {
    modern: 'modern-card',
    glass: 'glass-card p-8 rounded-[2.5rem]',
  };

  return (
    <div className={cn(variants[variant], className)} {...props}>
      {children}
    </div>
  );
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  ...props
}) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    warning: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    danger: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    info: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    neutral: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
  };

  return (
    <span className={cn('badge-modern', variants[variant], className)} {...props}>
      {children}
    </span>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  showHeader?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-2xl',
  showHeader = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={cn("modal-content", maxWidth)} 
        onClick={e => e.stopPropagation()}
      >
        {showHeader && (
          <div className="modal-header">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-display">{title}</h2>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-90"
            >
              <X size={24} />
            </button>
          </div>
        )}
        <div className="modal-body custom-scrollbar">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  headers: string[];
}

export const Table: React.FC<TableProps> = ({
  headers,
  children,
  className,
  ...props
}) => {
  return (
    <div className="overflow-x-auto custom-scrollbar pb-4">
      <table className={cn('table-modern', className)} {...props}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
};

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div className={cn("animate-pulse bg-slate-200 dark:bg-slate-800 rounded-xl", className)} {...props} />
  );
};
