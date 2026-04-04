import React from 'react';
import { cn } from '../../utils';

interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function AppInput({ label, error, icon, className, ...props }: AppInputProps) {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-4 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          className={cn(
            "w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 bg-white transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
            "placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400",
            icon && "pl-11",
            error && "border-danger focus:ring-danger/20 focus:border-danger",
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[10px] font-bold text-danger uppercase tracking-widest ml-1">
          {error}
        </p>
      )}
    </div>
  );
}
