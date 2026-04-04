import React from 'react';
import { cn } from '../../utils';

interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function AppCard({ children, className, onClick }: AppCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl shadow-card border border-slate-200 p-5", 
        onClick && "cursor-pointer hover:border-primary/30 transition-all",
        className
      )}
    >
      {children}
    </div>
  );
}
