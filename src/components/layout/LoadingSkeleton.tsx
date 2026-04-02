import React from 'react';
import { cn } from '../../utils';

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  variant?: 'card' | 'table' | 'text' | 'circle';
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  className, 
  count = 1,
  variant = 'text'
}) => {
  const baseClasses = "animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl";
  
  const variantClasses = {
    card: "h-48 w-full",
    table: "h-12 w-full mb-4",
    text: "h-4 w-full mb-2",
    circle: "h-12 w-12 rounded-full"
  };

  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className={cn(
            baseClasses,
            variantClasses[variant],
            className
          )} 
        />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
