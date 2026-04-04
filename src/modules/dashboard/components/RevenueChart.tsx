import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { formatCurrency } from '../../../utils';

interface RevenueChartProps {
  data: any[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-xs font-bold text-emerald-600">
              Receita: {formatCurrency(payload[0].value)}
            </p>
            <p className="text-xs font-bold text-rose-600">
              Despesa: {formatCurrency(payload[1].value)}
            </p>
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-black text-slate-900 dark:text-white">
                Lucro: {formatCurrency(payload[0].value - payload[1].value)}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight font-display uppercase tracking-widest">Fluxo de Caixa</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Últimos 7 dias</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Receita</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Despesa</span>
            </div>
          </div>
        </div>

        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
                animationDuration={1000}
              />
              <Area 
                type="monotone" 
                dataKey="expense" 
                stroke="#f43f5e" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorExpense)" 
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight font-display uppercase tracking-widest">Performance Diária</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Lucro Líquido</p>
          </div>
        </div>

        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-xs font-black">Lucro: {formatCurrency(Number(payload[0].value))}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]} animationDuration={1000}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
