import React, { useState } from 'react';
import { 
  Calendar, 
  AlertCircle,
  LayoutDashboard,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { ServiceOrder, OSStatus } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { OSService } from '../../services/os';

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

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

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
      <PageHeader 
        title="Dashboard"
        subtitle="Bem-vindo de volta ao seu painel de controle."
        breadcrumbs={[{ label: 'AutoGestão' }, { label: 'Dashboard' }]}
        actions={
          <div className="flex items-center gap-4">
            <AIAnalysis stats={stats} />
            <div className="px-5 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center gap-3 shadow-sm">
              <Calendar size={18} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
          </div>
        }
      />

      <div className="space-y-8">
        {/* Low Stock Alert */}
        <LowStockAlert 
          lowStock={stats.lowStock} 
          lowStockItems={lowStockItems} 
          setActiveTab={setActiveTab} 
        />

        {/* KPI Grid */}
        <KPIs stats={stats} setActiveTab={setActiveTab} />

        {/* Revenue Chart Section */}
        {isAdmin && (
          <SectionCard title="Visão Geral de Receita" subtitle="Acompanhamento mensal de faturamento">
            <RevenueChart data={revenueData} />
          </SectionCard>
        )}

        {/* Sales Opportunities Widget */}
        <SalesOpportunities 
          hotLeads={stats.hotLeads} 
          proposalsInProgress={stats.proposalsInProgress} 
        />

        {/* Agenda Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <DailyAgenda 
              appointments={todayAppointmentsList} 
              clients={clients} 
              vehicles={vehicles} 
              services={services} 
              setActiveTab={setActiveTab} 
            />
          </div>

          <div className="space-y-8">
            <QuickStats 
              totalClients={stats.totalClients} 
              totalVehicles={stats.totalVehicles} 
              salesLast7Days={stats.salesLast7Days} 
            />
            <QuickActions setActiveTab={setActiveTab} />
          </div>
        </div>

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
    </PageContainer>
  );
};

export default Dashboard;
