import React from 'react';
import { cn } from '../../utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200", className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="modern-card !p-8 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-12 py-8">
          <Skeleton className="h-6 w-full" />
        </td>
      ))}
    </tr>
  );
}
