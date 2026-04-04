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

import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';
import EmptyState from '../../components/layout/EmptyState';
import LoadingSkeleton from '../../components/layout/LoadingSkeleton';

import { AppButton } from '../../components/ui/AppButton';

const Analytics: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const { canView } = usePermissions('analytics');
  const empresaId = profile?.empresaId || '';
  
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '12m' | 'all'>('30d');

  const { data, loading } = useAnalyticsData(empresaId, period);

  if (!canView) {
    return (
      <PageContainer>
        <EmptyState 
          icon={AlertCircle}
          title="Acesso Restrito"
          description="Você não tem permissão para visualizar os Relatórios Analíticos. Entre em contato com o administrador."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader 
        title="Relatórios & BI"
        subtitle="Análise profunda do seu negócio em tempo real."
        breadcrumbs={[{ label: 'AutoGestão' }, { label: 'Relatórios' }]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white border border-slate-100 rounded-2xl p-1 shadow-sm">
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
                      ? 'bg-slate-900 text-white shadow-lg' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <AppButton variant="secondary" size="sm" className="p-3">
              <Download size={20} />
            </AppButton>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <LoadingSkeleton key={i} className="h-32 rounded-[2.5rem]" />
            ))}
          </div>
          <LoadingSkeleton className="h-96 rounded-[2.5rem]" />
        </div>
      ) : data ? (
        <div className="space-y-8 sm:space-y-12">
          {/* Summary Section */}
          <SummaryCards metrics={data.metrics} />

          {/* Main Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <SectionCard title="Faturamento & Receita" subtitle="Acompanhamento de entradas e saídas">
                <BillingCharts data={data.billing} />
              </SectionCard>
            </div>
            <div>
              <SectionCard title="Lucro por Categoria" subtitle="Distribuição de rentabilidade">
                <ProfitAnalysis data={data.profitByCategory} />
              </SectionCard>
            </div>
          </div>

          {/* Team & Operations Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SectionCard title="Desempenho da Equipe" subtitle="Produtividade por técnico">
              <TechnicianStats data={data.technicians} />
            </SectionCard>
            <SectionCard title="Itens Mais Vendidos" subtitle="Serviços e peças em destaque">
              <TopItems services={data.topServices} parts={data.topParts} />
            </SectionCard>
          </div>

          {/* Client Intelligence Section */}
          <SectionCard title="Inteligência de Clientes" subtitle="Comportamento e fidelização">
            <ClientAnalytics 
              recurring={data.recurringClients} 
              abc={data.clientABC} 
              metrics={data.metrics}
            />
          </SectionCard>
        </div>
      ) : (
        <EmptyState 
          icon={BarChart3}
          title="Sem dados para o período"
          description="Nenhum dado encontrado para o período selecionado. Tente alterar o filtro de data."
        />
      )}
    </PageContainer>
  );
};

export default Analytics;
