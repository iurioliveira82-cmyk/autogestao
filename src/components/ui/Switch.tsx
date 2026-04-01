import React from 'react';
import { cn } from '../../utils';

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Switch: React.FC<SwitchProps> = ({ label, className, ...props }) => {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          {...props}
        />
        <div className={cn(
          "w-14 h-8 bg-zinc-200 dark:bg-zinc-800 rounded-full transition-colors duration-300 peer-checked:bg-accent",
          className
        )}>
          <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6 shadow-sm" />
        </div>
      </div>
      {label && <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{label}</span>}
    </label>
  );
};
