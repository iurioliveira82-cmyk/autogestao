import React from 'react';
import { cn } from '../../utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && <label className="label-modern">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-accent transition-colors">
            {icon}
          </div>
        )}
        <input
          className={cn(
            'input-modern',
            icon && 'pl-14',
            error && 'border-red-500 focus:ring-red-500/10 focus:border-red-500',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest ml-1">{error}</p>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  icon,
  className,
  children,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && <label className="label-modern">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-accent transition-colors pointer-events-none">
            {icon}
          </div>
        )}
        <select
          className={cn(
            'select-modern',
            icon && 'pl-14',
            error && 'border-red-500 focus:ring-red-500/10 focus:border-red-500',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none group-focus-within:text-accent transition-colors">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest ml-1">{error}</p>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && <label className="label-modern">{label}</label>}
      <textarea
        className={cn(
          'textarea-modern',
          error && 'border-red-500 focus:ring-red-500/10 focus:border-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-500 uppercase tracking-widest ml-1">{error}</p>}
    </div>
  );
};
