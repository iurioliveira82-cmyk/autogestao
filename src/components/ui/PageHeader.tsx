import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
      <div>
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight font-display">{title}</h1>
        {description && <p className="text-lg text-zinc-500 font-medium mt-2">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
