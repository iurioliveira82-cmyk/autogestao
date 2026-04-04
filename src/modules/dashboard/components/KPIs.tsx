import React from 'react';
import { DollarSign, ClipboardList, Calendar, AlertCircle, ArrowUpRight } from 'lucide-react';
import { cn, formatCurrency } from '../../../utils';
import { AppCard } from '../../../components/ui/AppCard';
import { AppButton } from '../../../components/ui/AppButton';

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
    { label: 'Lucro Hoje', value: formatCurrency(stats.dailyRevenue - stats.dailyExpense), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', link: 'finance' },
    { label: 'OS em Aberto', value: stats.activeOS, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50', link: 'os' },
    { label: 'Agenda Hoje', value: stats.todayAppointments, icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50', link: 'agenda' },
    { label: 'Estoque Baixo', value: stats.lowStock, icon: AlertCircle, color: stats.lowStock > 0 ? 'text-rose-600' : 'text-slate-400', bg: stats.lowStock > 0 ? 'bg-rose-50' : 'bg-slate-50', link: 'inventory' },
  ], [stats]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, i) => (
        <AppCard 
          key={i} 
          className="group relative overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 bg-white dark:bg-slate-900"
          onClick={() => kpi.link && setActiveTab?.(kpi.link)}
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2.5 rounded-xl transition-all group-hover:scale-110 duration-500", kpi.bg)}>
                <kpi.icon size={20} className={kpi.color} />
              </div>
              <div className="text-slate-300 dark:text-slate-700 group-hover:text-primary transition-colors">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-display">{kpi.value}</h3>
            </div>
          </div>
          
          {/* Subtle background decoration */}
          <div className={cn(
            "absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
            kpi.bg
          )} />
        </AppCard>
      ))}
    </div>
  );
};

