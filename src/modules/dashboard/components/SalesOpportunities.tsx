import React from 'react';
import { TrendingUp, ClipboardList, Sparkles } from 'lucide-react';

interface SalesOpportunitiesProps {
  hotLeads: number;
  proposalsInProgress: number;
}

export const SalesOpportunities: React.FC<SalesOpportunitiesProps> = ({ hotLeads, proposalsInProgress }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 relative overflow-hidden group shadow-sm">
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight font-display">Vendas</h3>
          <p className="text-xs text-slate-500 font-medium">Funil de oportunidades</p>
        </div>
        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl">
          <Sparkles size={18} />
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group/card hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl group-hover/card:scale-110 transition-transform duration-300">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Leads Quentes</p>
              <h4 className="text-xl font-black text-slate-900 dark:text-white font-display">{hotLeads}</h4>
            </div>
          </div>
          <span className="text-[8px] font-black text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg uppercase tracking-widest border border-orange-100 dark:border-orange-900/30">Alta</span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group/card hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl group-hover/card:scale-110 transition-transform duration-300">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Propostas</p>
              <h4 className="text-xl font-black text-slate-900 dark:text-white font-display">{proposalsInProgress}</h4>
            </div>
          </div>
          <span className="text-[8px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">Ativas</span>
        </div>
      </div>

      {/* Decorative background element */}
      <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
    </div>
  );
};
