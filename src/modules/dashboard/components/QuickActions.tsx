import React from 'react';
import { Plus, UserPlus, DollarSign, Package } from 'lucide-react';
import { cn } from '../../../utils';

interface QuickActionsProps {
  setActiveTab?: (tab: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ setActiveTab }) => {
  const actions = [
    { label: 'Nova OS', icon: Plus, link: 'os', color: 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-accent hover:text-accent-foreground' },
    { label: 'Novo Lead', icon: UserPlus, link: 'leads', color: 'bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800' },
    { label: 'Financeiro', icon: DollarSign, link: 'finance', color: 'bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800' },
    { label: 'Estoque', icon: Package, link: 'inventory', color: 'bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800' },
  ];

  return (
    <div className="modern-card !p-10 group dark:bg-zinc-900 dark:border-zinc-800">
      <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-8 font-display">Atalhos Rápidos</h3>
      <div className="grid grid-cols-2 gap-5">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => setActiveTab?.(action.link)}
            className={cn(
              "flex flex-col items-center justify-center gap-4 p-6 rounded-3xl transition-all duration-300 hover:translate-y-[-4px] active:scale-95 shadow-sm border border-zinc-100 dark:border-zinc-800",
              action.color
            )}
          >
            <div className="p-3 bg-current/10 rounded-xl">
              <action.icon size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
