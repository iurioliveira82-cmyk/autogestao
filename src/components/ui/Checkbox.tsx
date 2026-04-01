import React from 'react';
import { cn } from '../../utils';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, className, ...props }) => {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          className={cn(
            "peer appearance-none w-6 h-6 border-2 border-border rounded-lg bg-zinc-50 dark:bg-zinc-900 checked:bg-accent checked:border-accent transition-all duration-300",
            className
          )}
          {...props}
        />
        <svg
          className="absolute w-4 h-4 text-accent-foreground opacity-0 peer-checked:opacity-100 transition-opacity duration-300 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      {label && <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{label}</span>}
    </label>
  );
};
