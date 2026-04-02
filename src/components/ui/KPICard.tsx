import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../../utils';

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({ label, value, icon: Icon, color, bg, onClick }) => {
  return (
    <Card className="group !p-8 hover:translate-y-[-4px] transition-all duration-500 cursor-pointer" onClick={onClick}>
      <div className="flex items-center justify-between mb-8">
        <div className={cn("p-5 rounded-2xl transition-all group-hover:scale-110 group-hover:rotate-3 duration-500 shadow-sm", bg)}>
          <Icon size={32} className={cn("sm:w-8 sm:h-8", color)} />
        </div>
      </div>
      <div>
        <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{label}</p>
        <h3 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-display">{value}</h3>
      </div>
    </Card>
  );
};
