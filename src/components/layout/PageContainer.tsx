import React from 'react';
import { cn } from '../../utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | '7xl';
}

const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  className,
  maxWidth = '7xl'
}) => {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full'
  };

  return (
    <div className={cn(
      "flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 custom-scrollbar animate-in fade-in duration-500",
      className
    )}>
      <div className={cn("mx-auto w-full", maxWidthClasses[maxWidth])}>
        {children}
      </div>
    </div>
  );
};

export default PageContainer;
