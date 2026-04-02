import React from 'react';
import { cn } from '../../utils';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div className={cn("flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-border", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300",
            activeTab === tab.id
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
