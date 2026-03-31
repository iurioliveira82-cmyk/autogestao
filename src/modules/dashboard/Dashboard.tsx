import React, { useState } from 'react';
import { 
  Calendar, 
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { ServiceOrder, OSStatus } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { OSService } from '../../services/os';

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
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Acesso Restrito</h2>
        <p className="text-zinc-500 max-w-md">Você não tem permissão para visualizar o Dashboard. Entre em contato com o administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-12 animate-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-900 tracking-tight font-display">Dashboard</h1>
          <p className="text-sm sm:text-lg text-zinc-500 font-medium mt-1">Bem-vindo de volta ao seu painel de controle.</p>
        </div>
        <div className="flex items-center gap-4">
          <AIAnalysis stats={stats} />
          <div className="px-5 py-3 bg-white border border-zinc-100 rounded-2xl flex items-center gap-3 shadow-modern">
            <Calendar size={18} className="text-zinc-400" />
            <span className="text-sm font-bold text-zinc-700">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</span>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      <LowStockAlert 
        lowStock={stats.lowStock} 
        lowStockItems={lowStockItems} 
        setActiveTab={setActiveTab} 
      />

      {/* KPI Grid */}
      <KPIs stats={stats} setActiveTab={setActiveTab} />

      {/* Revenue Chart Section */}
      {isAdmin && <RevenueChart data={revenueData} />}

      {/* Sales Opportunities Widget */}
      <SalesOpportunities 
        hotLeads={stats.hotLeads} 
        proposalsInProgress={stats.proposalsInProgress} 
      />

      {/* Agenda Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
        <DailyAgenda 
          appointments={todayAppointmentsList} 
          clients={clients} 
          vehicles={vehicles} 
          services={services} 
          setActiveTab={setActiveTab} 
        />

        <div className="space-y-8 sm:space-y-10">
          <QuickStats 
            totalClients={stats.totalClients} 
            totalVehicles={stats.totalVehicles} 
            salesLast7Days={stats.salesLast7Days} 
          />
          <QuickActions setActiveTab={setActiveTab} />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentOS 
        recentOS={recentOS} 
        clients={clients} 
        selectedDate={selectedDate} 
        setSelectedDate={setSelectedDate} 
        handleUpdateStatus={handleUpdateStatus} 
        setActiveTab={setActiveTab} 
      />
    </div>
  );
};

export default Dashboard;
