import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { formatCurrency } from '../../../utils';
import { UserCircle, Zap, ClipboardList } from 'lucide-react';

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
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="bg-white border border-zinc-100 p-8 rounded-[2.5rem] shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-zinc-900 tracking-tight">Produtividade por Técnico</h3>
          <p className="text-xs text-zinc-500 font-medium">Desempenho da equipe técnica</p>
        </div>
      </div>

      <div className="space-y-6">
        {data.map((tech, i) => (
          <div key={tech.id} className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 hover:bg-white hover:shadow-xl hover:shadow-zinc-100 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-100 group-hover:scale-110 transition-transform">
                  <UserCircle size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-zinc-900 tracking-tight">{tech.name}</h4>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Técnico Especialista</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-zinc-900">{formatCurrency(tech.revenue)}</p>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Faturamento Gerado</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-zinc-100">
                <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                  <ClipboardList size={14} />
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-900">{tech.osCount}</p>
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">OS Finalizadas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-zinc-100">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
                  <Zap size={14} />
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-900">{tech.productivity.toFixed(1)}</p>
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">OS / Dia Ativo</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-zinc-500 font-medium">Nenhum dado de técnico disponível.</p>
        </div>
      )}
    </div>
  );
};
