import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Zap, 
  Users2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { formatCurrency } from '../../../utils';

interface SummaryCardsProps {
  metrics: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    avgTicket: number;
    returnRate: number;
    ltv: number;
  };
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ metrics }) => {
  const cards = [
    {
      label: 'Faturamento Total',
      value: formatCurrency(metrics.totalRevenue),
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      trend: '+12.5%',
      isPositive: true
    },
    {
      label: 'Lucro Líquido',
      value: formatCurrency(metrics.totalProfit),
      icon: TrendingUp,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      trend: '+8.2%',
      isPositive: true
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(metrics.avgTicket),
      icon: Target,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      trend: '-2.4%',
      isPositive: false
    },
    {
      label: 'Lifetime Value (LTV)',
      value: formatCurrency(metrics.ltv),
      icon: Zap,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      trend: '+15.1%',
      isPositive: true
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, i) => (
        <div 
          key={i} 
          className="bg-white border border-zinc-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:shadow-zinc-100 transition-all group"
        >
          <div className="flex items-center justify-between mb-6">
            <div className={`p-4 ${card.bg} ${card.color} rounded-2xl group-hover:scale-110 transition-transform`}>
              <card.icon size={24} />
            </div>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              card.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              {card.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {card.trend}
            </div>
          </div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">{card.label}</p>
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{card.value}</h3>
        </div>
      ))}
    </div>
  );
};
