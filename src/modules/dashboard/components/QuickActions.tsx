import React from 'react';
import { Plus, UserPlus, DollarSign, Package } from 'lucide-react';
import { cn } from '../../../utils';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

interface QuickActionsProps {
  setActiveTab?: (tab: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ setActiveTab }) => {
  const actions = [
    { label: 'Nova OS', icon: Plus, link: 'os', variant: 'primary' as const },
    { label: 'Novo Lead', icon: UserPlus, link: 'leads', variant: 'outline' as const },
    { label: 'Financeiro', icon: DollarSign, link: 'finance', variant: 'outline' as const },
    { label: 'Estoque', icon: Package, link: 'inventory', variant: 'outline' as const },
  ];

  return (
    <Card className="!p-10 group">
      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 font-display">Atalhos Rápidos</h3>
      <div className="grid grid-cols-2 gap-5">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant={action.variant}
            onClick={() => setActiveTab?.(action.link)}
            className="flex-col !py-8 gap-4 h-auto rounded-3xl"
          >
            <div className="p-3 bg-current/10 rounded-xl">
              <action.icon size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{action.label}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
};

