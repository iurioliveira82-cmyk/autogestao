import React from 'react';
import { cn } from '../../utils';

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, description, children, className }) => {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="border-b border-border pb-6">
        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight font-display">{title}</h3>
        {description && <p className="text-sm text-slate-500 font-medium mt-1">{description}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {children}
      </div>
    </div>
  );
};
