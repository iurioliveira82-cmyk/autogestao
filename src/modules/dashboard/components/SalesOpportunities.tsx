import React from 'react';
import { TrendingUp, ClipboardList, Sparkles } from 'lucide-react';

interface SalesOpportunitiesProps {
  hotLeads: number;
  proposalsInProgress: number;
}

export const SalesOpportunities: React.FC<SalesOpportunitiesProps> = ({ hotLeads, proposalsInProgress }) => {
  return (
    <div className="modern-card !p-10 sm:!p-16 relative overflow-hidden group">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12 relative z-10">
        <div>
          <h3 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight font-display">Oportunidades de Vendas</h3>
          <p className="text-base sm:text-lg text-zinc-500 font-medium mt-2">Resumo de leads e propostas ativas no funil</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-5 py-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex items-center gap-3 shadow-sm">
            <Sparkles size={20} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Foco em Conversão</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
        <div className="bg-zinc-50/50 p-10 rounded-[2.5rem] border border-zinc-100 flex items-center justify-between group/card hover:bg-white hover:shadow-2xl hover:shadow-orange-100/50 transition-all duration-500">
          <div className="flex items-center gap-8">
            <div className="p-6 bg-orange-100 text-orange-600 rounded-3xl group-hover/card:scale-110 group-hover/card:rotate-3 transition-transform duration-500 shadow-sm">
              <TrendingUp size={32} />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Leads Quentes</p>
              <h4 className="text-5xl font-black text-zinc-900 font-display">{hotLeads}</h4>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-4 py-2 rounded-2xl uppercase tracking-widest border border-orange-100">Prioridade Alta</span>
          </div>
        </div>

        <div className="bg-zinc-50/50 p-10 rounded-[2.5rem] border border-zinc-100 flex items-center justify-between group/card hover:bg-white hover:shadow-2xl hover:shadow-blue-100/50 transition-all duration-500">
          <div className="flex items-center gap-8">
            <div className="p-6 bg-blue-100 text-blue-600 rounded-3xl group-hover/card:scale-110 group-hover/card:-rotate-3 transition-transform duration-500 shadow-sm">
              <ClipboardList size={32} />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Propostas Ativas</p>
              <h4 className="text-5xl font-black text-zinc-900 font-display">{proposalsInProgress}</h4>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-2xl uppercase tracking-widest border border-blue-100">Aguardando</span>
          </div>
        </div>
      </div>

      {/* Decorative background element */}
      <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />
    </div>
  );
};
