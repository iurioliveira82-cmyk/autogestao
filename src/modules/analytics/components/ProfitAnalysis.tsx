import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { formatCurrency } from '../../../utils';
import { AppCard } from '../../../components/ui/AppCard';

interface ProfitAnalysisProps {
  data: {
    category: string;
    revenue: number;
    cost: number;
    profit: number;
  }[];
}

export const ProfitAnalysis: React.FC<ProfitAnalysisProps> = ({ data }) => {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0f172a'];

  const chartData = data.map(d => ({
    name: d.category,
    value: d.profit
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-2xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].name}</p>
          <p className="text-sm font-black text-white">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <AppCard className="p-8 h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Lucro por Categoria</h3>
          <p className="text-xs text-slate-500 font-medium">Distribuição de rentabilidade</p>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={8}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              formatter={(value) => <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-12 space-y-4">
        {data.map((cat, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all group">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <div>
                <h5 className="text-xs font-black text-slate-900 tracking-tight">{cat.category}</h5>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Margem: {((cat.profit / cat.revenue) * 100).toFixed(1)}%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-slate-900">{formatCurrency(cat.profit)}</p>
              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1">Lucro</p>
            </div>
          </div>
        ))}
      </div>
    </AppCard>
  );
};
