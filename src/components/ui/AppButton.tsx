import React from 'react';
import { cn } from '../../utils';

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export function AppButton({ 
  children, 
  variant = 'primary', 
  size = 'md',
  icon,
  loading,
  className,
  disabled,
  ...props 
}: AppButtonProps) {
  const variants = {
    primary: 'bg-primary text-white hover:opacity-90 shadow-sm',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
    outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    ghost: 'text-slate-500 hover:bg-slate-100'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button 
      className={cn(
        'rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
    </button>
  );
}
