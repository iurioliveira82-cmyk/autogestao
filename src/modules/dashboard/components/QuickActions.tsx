import React from 'react';
import { Plus, UserPlus, DollarSign, Package } from 'lucide-react';
import SectionCard from '../../../components/layout/SectionCard';
import { cn } from '../../../utils';
import { AppButton } from '../../../components/ui/AppButton';

interface QuickActionsProps {
  setActiveTab?: (tab: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ setActiveTab }) => {
  const actions = [
    { label: 'Nova OS', icon: Plus, link: 'os', variant: 'primary' as const },
    { label: 'Novo Lead', icon: UserPlus, link: 'leads', variant: 'secondary' as const },
    { label: 'Financeiro', icon: DollarSign, link: 'finance', variant: 'secondary' as const },
    { label: 'Estoque', icon: Package, link: 'inventory', variant: 'secondary' as const },
  ];

  return (
    <SectionCard title="Atalhos Rápidos" subtitle="Ações frequentes do sistema">
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => setActiveTab?.(action.link)}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden border-2",
              action.variant === 'primary' 
                ? "bg-primary border-primary text-white hover:bg-primary/90" 
                : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-primary/30"
            )}
          >
            <div className={cn(
              "p-3 rounded-xl mb-3 transition-transform duration-500 group-hover:scale-110",
              action.variant === 'primary' ? "bg-white/20" : "bg-slate-50 dark:bg-slate-800"
            )}>
              <action.icon size={20} className={action.variant === 'primary' ? "text-white" : "text-slate-600 dark:text-slate-400"} />
            </div>
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              action.variant === 'primary' ? "text-white" : "text-slate-500 dark:text-slate-400"
            )}>
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
};

