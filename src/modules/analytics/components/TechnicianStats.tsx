import React from 'react';
import { formatCurrency } from '../../../utils';
import { UserCircle, Zap, ClipboardList } from 'lucide-react';
import { AppCard } from '../../../components/ui/AppCard';

interface TechnicianStatsProps {
  data: {
    id: string;
    name: string;
    osCount: number;
    revenue: number;
    productivity: number;
  }[];
}

export const TechnicianStats: React.FC<TechnicianStatsProps> = ({ data }) => {
  return (
    <AppCard className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Produtividade por Técnico</h3>
          <p className="text-xs text-slate-500 font-medium">Desempenho da equipe técnica</p>
        </div>
      </div>

      <div className="space-y-6">
        {data.map((tech) => (
          <div key={tech.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:scale-110 transition-transform">
                  <UserCircle size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight">{tech.name}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Técnico Especialista</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">{formatCurrency(tech.revenue)}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Faturamento Gerado</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100">
                <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                  <ClipboardList size={14} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">{tech.osCount}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">OS Finalizadas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
                  <Zap size={14} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">{tech.productivity.toFixed(1)}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">OS / Dia Ativo</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-slate-500 font-medium">Nenhum dado de técnico disponível.</p>
        </div>
      )}
    </AppCard>
  );
};
