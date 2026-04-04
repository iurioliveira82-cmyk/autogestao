import React from 'react';
import { Users, Car, TrendingUp, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../../utils';
import { AppCard } from '../../../components/ui/AppCard';

interface QuickStatsProps {
  totalClients: number;
  totalVehicles: number;
  salesLast7Days: number;
}

export const QuickStats: React.FC<QuickStatsProps> = ({ totalClients, totalVehicles, salesLast7Days }) => {
  return (
    <AppCard className="bg-slate-900 dark:bg-black text-white border-none shadow-xl relative overflow-hidden group flex flex-col p-6">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black tracking-tight font-display">Visão Geral</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Base de Dados</p>
          </div>
          <div className="p-2.5 bg-white/10 rounded-xl group-hover:rotate-12 transition-transform duration-500">
            <TrendingUp size={20} className="text-primary" />
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="group/stat flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg text-white/40 group-hover/stat:text-primary transition-colors">
                <Users size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Clientes</span>
            </div>
            <span className="text-xl font-black font-display">{totalClients}</span>
          </div>
          
          <div className="group/stat flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg text-white/40 group-hover/stat:text-primary transition-colors">
                <Car size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Veículos</span>
            </div>
            <span className="text-xl font-black font-display">{totalVehicles}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 p-5 bg-white/5 rounded-2xl text-white relative z-10 border border-white/5 group/sales">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Vendas 7 Dias</p>
          <div className="flex items-center gap-1 text-[8px] font-black text-primary bg-primary/10 px-2 py-1 rounded-lg uppercase tracking-widest">
            <Sparkles size={10} />
            Crescimento
          </div>
        </div>
        <h4 className="text-2xl font-black tracking-tighter font-display group-hover/sales:text-primary transition-colors">
          {formatCurrency(salesLast7Days)}
        </h4>
      </div>
      
      {/* Decorative background elements */}
      <div className="absolute -top-10 -left-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
    </AppCard>
  );
};

