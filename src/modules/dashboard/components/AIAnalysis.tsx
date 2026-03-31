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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerateAIAnalysis}
          disabled={isGeneratingAI}
          className="btn-modern flex items-center gap-2"
        >
          {isGeneratingAI ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} className="text-amber-400" />
          )}
          Análise de IA
        </button>
      </div>

      <AnimatePresence>
        {aiAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white text-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-2xl relative overflow-hidden group"
          >
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-100 rounded-xl">
                  <Sparkles size={20} className="text-amber-500" />
                </div>
                <h3 className="text-lg font-bold">Insights da Inteligência Artificial</h3>
              </div>
              <button 
                onClick={() => setAiAnalysis(null)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <XCircle size={20} className="text-zinc-400" />
              </button>
            </div>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed relative z-10 italic">
              "{aiAnalysis}"
            </p>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-zinc-50 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
