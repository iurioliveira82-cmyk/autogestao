import React from 'react';
import { DollarSign, ClipboardList, Calendar, AlertCircle, ArrowUpRight } from 'lucide-react';
import { cn, formatCurrency } from '../../../utils';

interface KPIProps {
  stats: {
    dailyRevenue: number;
    dailyExpense: number;
    activeOS: number;
    todayAppointments: number;
    lowStock: number;
  };
  setActiveTab?: (tab: string) => void;
}

export const KPIs: React.FC<KPIProps> = ({ stats, setActiveTab }) => {
  const kpis = React.useMemo(() => [
    { label: 'Lucro Hoje', value: formatCurrency(stats.dailyRevenue - stats.dailyExpense), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', link: 'finance' },
    { label: 'OS em Aberto', value: stats.activeOS, icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-500/10', link: 'os' },
    { label: 'Agenda Hoje', value: stats.todayAppointments, icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-500/10', link: 'agenda' },
    { label: 'Estoque Baixo', value: stats.lowStock, icon: AlertCircle, color: stats.lowStock > 0 ? 'text-rose-500' : 'text-zinc-400', bg: stats.lowStock > 0 ? 'bg-rose-500/10' : 'bg-zinc-500/10', link: 'inventory' },
  ], [stats]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
      {kpis.map((kpi, i) => (
        <div key={i} className="modern-card group !p-8 hover:translate-y-[-4px] transition-all duration-500 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-8">
            <div className={cn("p-5 rounded-2xl transition-all group-hover:scale-110 group-hover:rotate-3 duration-500 shadow-sm", kpi.bg)}>
              <kpi.icon size={32} className={cn("sm:w-8 sm:h-8", kpi.color)} />
            </div>
            <button 
              onClick={() => kpi.link && setActiveTab?.(kpi.link)}
              className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-300 group-hover:text-accent group-hover:bg-accent/10 transition-all cursor-pointer active:scale-90"
            >
              <ArrowUpRight size={24} />
            </button>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">{kpi.label}</p>
            <h3 className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight font-display">{kpi.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};
