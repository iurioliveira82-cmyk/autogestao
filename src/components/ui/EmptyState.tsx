import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center bg-slate-50 dark:bg-slate-900 rounded-[3rem] border border-dashed border-border group">
      <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-sm mb-6 group-hover:rotate-12 transition-transform duration-700 border border-border">
        <Icon size={48} className="text-slate-300 dark:text-slate-600" />
      </div>
      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 font-display">{title}</h3>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
