import React from 'react';
import { 
  Wrench, 
  Package, 
  TrendingUp, 
  PieChart 
} from 'lucide-react';
import { formatCurrency } from '../../../utils';

interface TopItemsProps {
  services: { name: string; count: number; revenue: number }[];
  parts: { name: string; count: number; revenue: number }[];
}

export const TopItems: React.FC<TopItemsProps> = ({ services, parts }) => {
  return (
    <div className="bg-white border border-zinc-100 p-8 rounded-[2.5rem] shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-zinc-900 tracking-tight">Top Itens & Serviços</h3>
          <p className="text-xs text-zinc-500 font-medium">Os mais vendidos e utilizados</p>
        </div>
      </div>

      <div className="space-y-12">
        {/* Top Services */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
              <Wrench size={16} />
            </div>
            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Serviços Mais Vendidos</h4>
          </div>

          <div className="space-y-4">
            {services.map((service, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-white hover:shadow-xl hover:shadow-zinc-100 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400 border border-zinc-100 group-hover:scale-110 transition-transform">
                    <span className="text-xs font-black text-zinc-900">{i + 1}</span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-zinc-900 tracking-tight">{service.name}</h5>
                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mt-1">{service.count} vendas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-zinc-900">{formatCurrency(service.revenue)}</p>
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mt-1">Faturamento</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Parts */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-50 text-purple-500 rounded-lg">
              <Package size={16} />
            </div>
            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Peças Mais Utilizadas</h4>
          </div>

          <div className="space-y-4">
            {parts.map((part, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:bg-white hover:shadow-xl hover:shadow-zinc-100 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400 border border-zinc-100 group-hover:scale-110 transition-transform">
                    <span className="text-xs font-black text-zinc-900">{i + 1}</span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-zinc-900 tracking-tight">{part.name}</h5>
                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mt-1">{part.count} unidades</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-zinc-900">{formatCurrency(part.revenue)}</p>
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mt-1">Faturamento</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
