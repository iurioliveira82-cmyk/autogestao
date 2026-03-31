import React from 'react';
import { 
  Users, 
  TrendingUp, 
  PieChart, 
  UserPlus, 
  UserCheck,
  Zap,
  Target,
  BarChart3
} from 'lucide-react';
import { formatCurrency } from '../../../utils';

interface ClientAnalyticsProps {
  recurring: { id: string; name: string; visitCount: number; totalSpent: number }[];
  abc: { id: string; name: string; revenue: number; percentage: number; category: 'A' | 'B' | 'C' }[];
  metrics: {
    returnRate: number;
    ltv: number;
    avgTicket: number;
  };
}

export const ClientAnalytics: React.FC<ClientAnalyticsProps> = ({ recurring, abc, metrics }) => {
  return (
    <div className="bg-white border border-zinc-100 p-8 rounded-[2.5rem] shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-zinc-900 tracking-tight">Inteligência de Clientes</h3>
          <p className="text-xs text-zinc-500 font-medium">Análise de recorrência e valor</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Recurring Clients */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg">
              <UserCheck size={16} />
            </div>
            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Clientes Recorrentes (Top 10)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recurring.map((client, i) => (
              <div key={client.id} className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 hover:bg-white hover:shadow-xl hover:shadow-zinc-100 transition-all group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-100 group-hover:scale-110 transition-transform">
                    <Users size={24} />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-zinc-900 tracking-tight">{client.name}</h5>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">{client.visitCount} visitas</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Gasto</p>
                  <p className="text-sm font-black text-zinc-900">{formatCurrency(client.totalSpent)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ABC Curve & Metrics */}
        <div className="space-y-8">
          <div className="p-8 bg-zinc-900 rounded-[2.5rem] text-white shadow-2xl shadow-zinc-200">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-white/10 rounded-lg">
                <BarChart3 size={16} className="text-accent" />
              </div>
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Resumo de Retenção</h4>
            </div>

            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Taxa de Retorno</p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-black tracking-tight">{metrics.returnRate.toFixed(1)}%</h3>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">+2.4%</p>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${metrics.returnRate}%` }} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Ticket Médio</p>
                <h3 className="text-2xl font-black tracking-tight">{formatCurrency(metrics.avgTicket)}</h3>
              </div>

              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Curva ABC (Top Clientes)</p>
                <div className="space-y-3 mt-4">
                  {['A', 'B', 'C'].map(cat => {
                    const count = abc.filter(c => c.category === cat).length;
                    const total = abc.length;
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const color = cat === 'A' ? 'bg-emerald-500' : cat === 'B' ? 'bg-blue-500' : 'bg-zinc-500';
                    return (
                      <div key={cat} className="flex items-center gap-4">
                        <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center text-[10px] font-black`}>
                          {cat}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                            <span>{count} clientes</span>
                            <span>{percentage.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
