import React, { useState } from 'react';
import { Sparkles, Loader2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { generateAIResponse } from '../../../services/gemini';
import { formatCurrency } from '../../../utils';

interface AIAnalysisProps {
  stats: {
    dailyRevenue: number;
    dailyExpense: number;
    activeOS: number;
    todayAppointments: number;
    lowStock: number;
    salesLast7Days: number;
  };
}

export const AIAnalysis: React.FC<AIAnalysisProps> = ({ stats }) => {
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const handleGenerateAIAnalysis = async () => {
    setIsGeneratingAI(true);
    try {
      const prompt = `
        Analise os seguintes dados de desempenho de uma oficina mecânica hoje:
        - Receita Diária: ${formatCurrency(stats.dailyRevenue)}
        - Despesa Diária: ${formatCurrency(stats.dailyExpense)}
        - Lucro Diário: ${formatCurrency(stats.dailyRevenue - stats.dailyExpense)}
        - Ordens de Serviço Ativas: ${stats.activeOS}
        - Agendamentos Hoje: ${stats.todayAppointments}
        - Itens com Estoque Baixo: ${stats.lowStock}
        - Vendas nos últimos 7 dias: ${formatCurrency(stats.salesLast7Days)}
        
        Forneça um resumo executivo de 3-4 frases com insights acionáveis e uma recomendação prioritária.
        Seja direto e profissional.
      `;

      const response = await generateAIResponse(prompt, 'Dashboard');
      setAiAnalysis(response || null);
      toast.success('Análise de IA concluída!');
    } catch (error) {
      toast.error('Erro ao gerar análise de IA.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="space-y-4">
      {!aiAnalysis && !isGeneratingAI && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="p-4 bg-amber-50 rounded-full mb-4">
            <Sparkles size={32} className="text-amber-400" />
          </div>
          <p className="text-sm text-slate-500 mb-4 px-4">
            Gere uma análise inteligente do desempenho da sua oficina hoje.
          </p>
          <button
            onClick={handleGenerateAIAnalysis}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={16} className="text-amber-400" />
            Gerar Insights
          </button>
        </div>
      )}

      {isGeneratingAI && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 size={32} className="text-primary animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-900">Analisando dados...</p>
          <p className="text-xs text-slate-500 mt-1">Isso levará apenas alguns segundos.</p>
        </div>
      )}

      <AnimatePresence>
        {aiAnalysis && !isGeneratingAI && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative z-10">
              <p className="text-sm text-slate-700 leading-relaxed italic">
                "{aiAnalysis}"
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Gerado agora mesmo
                </span>
                <button 
                  onClick={handleGenerateAIAnalysis}
                  className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
