import React from 'react';
import { Users, Car, TrendingUp, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../../utils';
import { Card } from '../../../components/ui/Card';

interface QuickStatsProps {
  totalClients: number;
  totalVehicles: number;
  salesLast7Days: number;
}

export const QuickStats: React.FC<QuickStatsProps> = ({ totalClients, totalVehicles, salesLast7Days }) => {
  return (
    <Card className="!p-10 bg-zinc-900 text-white border-none shadow-2xl shadow-zinc-900/20 relative overflow-hidden group flex flex-col min-h-[450px]">
      <div className="relative z-10 flex-1">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-2xl font-black tracking-tight font-display">Visão Geral</h3>
          <div className="p-4 bg-white/10 rounded-2xl group-hover:rotate-12 transition-transform duration-500">
            <TrendingUp size={28} className="text-accent" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="group/stat flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 rounded-[2rem] border border-white/5 transition-all duration-500">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 rounded-2xl text-white/40 group-hover/stat:text-accent transition-colors">
                <Users size={24} />
              </div>
              <span className="text-sm font-black uppercase tracking-[0.2em]">Clientes</span>
            </div>
            <span className="text-3xl font-black font-display">{totalClients}</span>
          </div>
          <div className="group/stat flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 rounded-[2rem] border border-white/5 transition-all duration-500">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 rounded-2xl text-white/40 group-hover/stat:text-accent transition-colors">
                <Car size={24} />
              </div>
              <span className="text-sm font-black uppercase tracking-[0.2em]">Veículos</span>
            </div>
            <span className="text-3xl font-black font-display">{totalVehicles}</span>
          </div>
        </div>
      </div>

      <div className="mt-12 p-10 bg-white/5 rounded-[2.5rem] text-white relative z-10 border border-white/5 group/sales">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-3">Vendas 7 Dias</p>
        <h4 className="text-4xl font-black tracking-tighter font-display group-hover/sales:text-accent transition-colors">{formatCurrency(salesLast7Days)}</h4>
        <div className="flex items-center gap-3 text-[10px] font-black text-accent mt-6 bg-accent/10 px-4 py-2 rounded-2xl w-fit uppercase tracking-widest">
          <Sparkles size={14} />
          Crescimento Constante
        </div>
      </div>
      
      {/* Decorative background elements */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
    </Card>
  );
};

