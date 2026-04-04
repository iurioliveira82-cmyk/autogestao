import React from 'react';
import { cn } from '../../utils';

interface StatusBadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'secondary';
  status?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatusBadge({ label, variant = 'neutral', status, icon, className }: StatusBadgeProps) {
  // Map status to variant if status is provided
  const getVariant = () => {
    if (status) {
      switch (status.toLowerCase()) {
        case 'paid':
        case 'active':
        case 'success':
        case 'completed':
        case 'confirmed':
          return 'success';
        case 'pending':
        case 'waiting':
        case 'warning':
          return 'warning';
        case 'cancelled':
        case 'inactive':
        case 'danger':
        case 'error':
          return 'danger';
        case 'in-progress':
        case 'info':
        case 'processing':
          return 'info';
        default:
          return 'neutral';
      }
    }
    return variant;
  };

  const activeVariant = getVariant();

  const variants = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    danger: 'bg-rose-50 text-rose-600 border-rose-100',
    info: 'bg-blue-50 text-blue-600 border-blue-100',
    neutral: 'bg-slate-50 text-slate-600 border-slate-100',
    primary: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    secondary: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-1.5",
      variants[activeVariant as keyof typeof variants] || variants.neutral,
      className
    )}>
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </span>
  );
}
