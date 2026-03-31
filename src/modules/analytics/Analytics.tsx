import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Wrench, 
  Package, 
  PieChart, 
  Calendar,
  Filter,
  Download,
  AlertCircle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Zap,
  Users2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { formatCurrency } from '../../utils';

// Sub-components
import { SummaryCards } from './components/SummaryCards';
import { BillingCharts } from './components/BillingCharts';
import { TechnicianStats } from './components/TechnicianStats';
import { TopItems } from './components/TopItems';
import { ClientAnalytics } from './components/ClientAnalytics';
import { ProfitAnalysis } from './components/ProfitAnalysis';

const Analytics: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const { canView } = usePermissions('analytics');
  const empresaId = profile?.empresaId || '';
  
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '12m' | 'all'>('30d');

  const { data, loading } = useAnalyticsData(empresaId, period);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 max-w-md">Você não tem permissão para visualizar os Relatórios Analíticos. Entre em contato com o administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-12 animate-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <BarChart3 size={20} />
            </div>
            <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Business Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-900 tracking-tight font-display">Relatórios & BI</h1>
          <p className="text-sm sm:text-lg text-zinc-500 font-medium mt-1">Análise profunda do seu negócio em tempo real.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-zinc-100 rounded-2xl p-1 shadow-sm">
            {[
              { id: '7d', label: '7 dias' },
              { id: '30d', label: '30 dias' },
              { id: '90d', label: '90 dias' },
              { id: '12m', label: '12 meses' },
              { id: 'all', label: 'Tudo' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  period === p.id 
                    ? 'bg-zinc-900 text-white shadow-lg' 
                    : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button className="p-3 bg-white border border-zinc-100 rounded-2xl text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm">
            <Download size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white border border-zinc-100 rounded-[2.5rem] animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Summary Section */}
          <SummaryCards metrics={data.metrics} />

          {/* Main Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <BillingCharts data={data.billing} />
            </div>
            <div>
              <ProfitAnalysis data={data.profitByCategory} />
            </div>
          </div>

          {/* Team & Operations Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <TechnicianStats data={data.technicians} />
            <TopItems services={data.topServices} parts={data.topParts} />
          </div>

          {/* Client Intelligence Section */}
          <ClientAnalytics 
            recurring={data.recurringClients} 
            abc={data.clientABC} 
            metrics={data.metrics}
          />
        </>
      ) : (
        <div className="py-20 text-center bg-white border border-dashed border-zinc-200 rounded-[2.5rem]">
          <p className="text-zinc-500 font-medium">Nenhum dado encontrado para o período selecionado.</p>
        </div>
      )}
    </div>
  );
};

export default Analytics;
