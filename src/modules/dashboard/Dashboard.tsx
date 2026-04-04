import React, { useState } from 'react';
import { 
  Calendar, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { ServiceOrder, OSStatus } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { OSService } from '../../services/os';
import { formatSafeDate } from '../../utils';

// Layout Components
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';
import EmptyState from '../../components/layout/EmptyState';

// Sub-components
import { KPIs } from './components/KPIs';
import { AIAnalysis } from './components/AIAnalysis';
import { LowStockAlert } from './components/LowStockAlert';
import { SalesOpportunities } from './components/SalesOpportunities';
import { DailyAgenda } from './components/DailyAgenda';
import { RecentOS } from './components/RecentOS';
import { QuickStats } from './components/QuickStats';
import { QuickActions } from './components/QuickActions';
import { RevenueChart } from './components/RevenueChart';

// Hook
import { useDashboardData } from './hooks/useDashboardData';

interface DashboardProps {
  setActiveTab?: (tab: string, itemId?: string, supplierId?: string, itemStatus?: OSStatus) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { isAdmin, profile } = useAuth();
  const { canView } = usePermissions('dashboard');
  const empresaId = profile?.empresaId || '';
  const osService = new OSService(empresaId);

  const [selectedDate, setSelectedDate] = useState(formatSafeDate(new Date(), 'yyyy-MM-dd'));

  const {
    stats,
    todayAppointmentsList,
    vehicles,
    services,
    recentOS,
    clients,
    lowStockItems,
    revenueData
  } = useDashboardData(empresaId, isAdmin || false, selectedDate);

  const handleUpdateStatus = async (os: ServiceOrder, newStatus: OSStatus) => {
    try {
      if (newStatus === 'finalizada' || newStatus === 'aprovada') {
        if (setActiveTab) {
          setActiveTab('os', os.id, undefined, newStatus);
          return;
        }
      }

      await osService.updateStatus(os.id, newStatus);
      toast.success(`Status da OS alterado para ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar status da OS.');
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <EmptyState 
          icon={AlertCircle}
          title="Acesso Restrito"
          description="Você não tem permissão para visualizar o Dashboard. Entre em contato com o administrador."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              <span>AutoGestão</span>
              <span className="text-slate-300">/</span>
              <span className="text-primary">Dashboard</span>
            </nav>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter font-display">
              Olá, {profile?.name?.split(' ')[0] || 'Usuário'}! 👋
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Aqui está o que está acontecendo na sua oficina hoje.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 shadow-sm">
              <Calendar size={18} className="text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Hoje</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  {formatSafeDate(new Date(), "dd 'de' MMMM")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Low Stock Alert */}
        <LowStockAlert 
          lowStock={stats.lowStock} 
          lowStockItems={lowStockItems} 
          setActiveTab={setActiveTab} 
        />

        {/* KPI Grid */}
        <KPIs stats={stats} setActiveTab={setActiveTab} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">
            {/* Revenue Chart Section */}
            {isAdmin && (
              <SectionCard 
                title="Visão Geral de Receita" 
                subtitle="Acompanhamento mensal de faturamento"
                className="overflow-hidden"
              >
                <div className="h-[300px]">
                  <RevenueChart data={revenueData} />
                </div>
              </SectionCard>
            )}

            {/* Agenda Section */}
            <DailyAgenda 
              appointments={todayAppointmentsList} 
              clients={clients} 
              vehicles={vehicles} 
              services={services} 
              setActiveTab={setActiveTab} 
            />

            {/* Recent Activity */}
            <SectionCard title="Atividade Recente" subtitle="Últimas ordens de serviço e movimentações">
              <RecentOS 
                recentOS={recentOS} 
                clients={clients} 
                selectedDate={selectedDate} 
                setSelectedDate={setSelectedDate} 
                handleUpdateStatus={handleUpdateStatus} 
                setActiveTab={setActiveTab} 
              />
            </SectionCard>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-8">
            {/* AI Analysis Card */}
            <SectionCard 
              title="Inteligência Artificial" 
              subtitle="Insights automáticos do seu negócio"
              icon={<Sparkles size={18} className="text-amber-500" />}
            >
              <AIAnalysis stats={stats} />
            </SectionCard>

            {/* Quick Actions */}
            <QuickActions setActiveTab={setActiveTab} />

            {/* Quick Stats */}
            <QuickStats 
              totalClients={stats.totalClients} 
              totalVehicles={stats.totalVehicles} 
              salesLast7Days={stats.salesLast7Days} 
            />

            {/* Sales Opportunities Widget */}
            <SalesOpportunities 
              hotLeads={stats.hotLeads} 
              proposalsInProgress={stats.proposalsInProgress} 
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;
