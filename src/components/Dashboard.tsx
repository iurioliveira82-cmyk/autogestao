import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Car, 
  ClipboardList, 
  Calendar, 
  DollarSign, 
  Package, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  XCircle,
  Plus,
  UserPlus,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { formatCurrency, cn, handleFirestoreError } from '../lib/utils';
import { ServiceOrder, Transaction, Client, Vehicle, OperationType, OSStatus, Appointment, Lead, Proposal, InventoryItem, FinancialTransaction } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from './Auth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { generateAIResponse } from '../services/gemini';

interface DashboardProps {
  setActiveTab?: (tab: string, itemId?: string, supplierId?: string, itemStatus?: OSStatus) => void;
}

import { FirestoreService } from '../services/firestore';

import { OSService } from '../services/os';

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { isAdmin, profile } = useAuth();
  const { canView } = usePermissions('dashboard');
  const empresaId = profile?.empresaId || '';
  const osService = new OSService(empresaId);

  const [stats, setStats] = useState({
    dailyRevenue: 0,
    dailyExpense: 0,
    activeOS: 0,
    todayAppointments: 0,
    totalClients: 0,
    totalVehicles: 0,
    lowStock: 0,
    resaleVehicles: 0,
    averageTicket: 0,
    salesLast7Days: 0,
    hotLeads: 0,
    proposalsInProgress: 0
  });

  const [todayAppointmentsList, setTodayAppointmentsList] = useState<Appointment[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [services, setServices] = useState<Record<string, string>>({});

  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [recentOS, setRecentOS] = useState<ServiceOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [clients, setClients] = useState<Record<string, string>>({});
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Static data
  useEffect(() => {
    if (!profile || !empresaId) return;

    // Clients
    const unsubscribeClients = FirestoreService.subscribeByEmpresa<Client>('clientes', empresaId, (data) => {
      setStats(prev => ({ ...prev, totalClients: data.length }));
      const clientMap: Record<string, string> = {};
      data.forEach(client => {
        clientMap[client.id] = client.name;
      });
      setClients(clientMap);
    });

    // Vehicles
    const unsubscribeVehicles = FirestoreService.subscribeByEmpresa<Vehicle>('veiculos', empresaId, (data) => {
      setStats(prev => ({ ...prev, totalVehicles: data.length }));
      const vehicleMap: Record<string, Vehicle> = {};
      data.forEach(vehicle => {
        vehicleMap[vehicle.id] = vehicle;
      });
      setVehicles(vehicleMap);
    });

    // Services
    const unsubscribeServices = FirestoreService.subscribeByEmpresa<any>('catalogo_servicos', empresaId, (data) => {
      const serviceMap: Record<string, string> = {};
      data.forEach(service => {
        serviceMap[service.id] = service.name;
      });
      setServices(serviceMap);
    });

    // Average Ticket (from finished OS)
    const unsubscribeCompletedOS = FirestoreService.subscribeByEmpresa<ServiceOrder>('ordens_servico', empresaId, (data) => {
      const finishedOS = data.filter(os => os.status === 'finalizada');
      let total = 0;
      finishedOS.forEach(os => {
        total += os.valorTotal || 0;
      });
      const avg = finishedOS.length > 0 ? total / finishedOS.length : 0;
      setStats(prev => ({ ...prev, averageTicket: avg }));
    }, [where('status', '==', 'finalizada')]);

    // Low Stock
    const unsubscribeStock = FirestoreService.subscribeByEmpresa<InventoryItem>('inventario', empresaId, (data) => {
      let low = 0;
      const items: any[] = [];
      data.forEach(item => {
        if (item.quantidadeAtual <= item.estoqueMinimo) {
          low++;
          items.push(item);
        }
      });
      setStats(prev => ({ ...prev, lowStock: low }));
      setLowStockItems(items);
    });

    // Leads
    const unsubscribeLeads = FirestoreService.subscribeByEmpresa<Lead>('leads', empresaId, (data) => {
      const hot = data.filter(d => d.temperature === 'hot' && !['convertido', 'perdido'].includes(d.status)).length;
      setStats(prev => ({ ...prev, hotLeads: hot }));
    });

    return () => {
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeServices();
      unsubscribeCompletedOS();
      unsubscribeStock();
      unsubscribeLeads();
    };
  }, [profile, empresaId]);

  // Date-dependent data
  useEffect(() => {
    if (!profile || !empresaId) return;

    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    // Daily Transactions
    const unsubscribeTransactions = FirestoreService.subscribeByEmpresa<FinancialTransaction>('transacoes_financeiras', empresaId, (data) => {
      let revenue = 0;
      let expense = 0;
      data.forEach(trans => {
        if (trans.type === 'in') revenue += trans.value;
        else expense += trans.value;
      });
      setStats(prev => ({ ...prev, dailyRevenue: revenue, dailyExpense: expense }));
    }, [where('date', '>=', start.toISOString()), where('date', '<=', end.toISOString())]);

    // Orders for selected date
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const startSelected = startOfDay(dateObj);
    const endSelected = endOfDay(dateObj);

    const unsubscribeOS = FirestoreService.subscribeByEmpresa<ServiceOrder>('ordens_servico', empresaId, (data) => {
      const activeStatuses = ['orcamento', 'aguardando_aprovacao', 'aprovada', 'em_execucao', 'aguardando_peca'];
      setStats(prev => ({ ...prev, activeOS: data.filter(d => activeStatuses.includes(d.status)).length }));
      setRecentOS(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, [where('createdAt', '>=', startSelected.toISOString()), where('createdAt', '<=', endSelected.toISOString())]);

    // Today's Appointments
    const unsubscribeAppointments = FirestoreService.subscribeByEmpresa<Appointment>('agendamentos', empresaId, (data) => {
      setStats(prev => ({ ...prev, todayAppointments: data.length }));
      setTodayAppointmentsList(data.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }, [where('startTime', '>=', start.toISOString()), where('startTime', '<=', end.toISOString())]);

    // Chart Data (Last 7 days) - Real-time
    let unsubscribeChart = () => {};
    if (isAdmin) {
      const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
      const qChart = query(
        collection(db, 'transacoes_financeiras'),
        where('empresaId', '==', empresaId),
        where('date', '>=', sevenDaysAgo.toISOString()),
        orderBy('date', 'asc')
      );

      unsubscribeChart = onSnapshot(qChart, (snapshot) => {
        const days: Record<string, { revenue: number, expense: number, name: string }> = {};
        let totalSales = 0;
        
        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
          const d = subDays(new Date(), i);
          const key = format(d, 'yyyy-MM-dd');
          days[key] = {
            revenue: 0,
            expense: 0,
            name: format(d, 'EEE', { locale: ptBR })
          };
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          const dateKey = data.date.split('T')[0];
          if (days[dateKey]) {
            if (data.type === 'in') {
              days[dateKey].revenue += data.value;
              totalSales += data.value;
            }
            else days[dateKey].expense += data.value;
          }
        });

        const chartData = Object.values(days).map(d => ({
          ...d,
          profit: d.revenue - d.expense
        }));
        
        setRevenueData(chartData);
        setStats(prev => ({ ...prev, salesLast7Days: totalSales }));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions_chart');
      });
    }

    return () => {
      unsubscribeTransactions();
      unsubscribeOS();
      unsubscribeAppointments();
      unsubscribeChart();
    };
  }, [profile, empresaId, isAdmin, selectedDate]);

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

  const kpis = React.useMemo(() => [
    { label: 'Lucro Hoje', value: formatCurrency(stats.dailyRevenue - stats.dailyExpense), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50', link: '#finance' },
    { label: 'OS em Aberto', value: stats.activeOS, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50', link: '#os' },
    { label: 'Agenda Hoje', value: stats.todayAppointments, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50', link: '#agenda' },
    { label: 'Estoque Baixo', value: stats.lowStock, icon: AlertCircle, color: stats.lowStock > 0 ? 'text-red-600' : 'text-zinc-400', bg: stats.lowStock > 0 ? 'bg-red-50' : 'bg-zinc-50', link: '#inventory' },
  ], [stats.dailyRevenue, stats.dailyExpense, stats.activeOS, stats.todayAppointments, stats.lowStock]);

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
          <div className="px-5 py-3 bg-white border border-zinc-100 rounded-2xl flex items-center gap-3 shadow-modern">
            <Calendar size={18} className="text-zinc-400" />
            <span className="text-sm font-bold text-zinc-700">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</span>
          </div>
        </div>
      </div>

      {/* AI Analysis Result */}
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

      {/* Low Stock Alert */}
      {stats.lowStock > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 flex flex-col sm:flex-row items-start gap-4 sm:gap-6 shadow-xl shadow-red-100/50 relative overflow-hidden group">
          <div className="p-3 sm:p-4 bg-red-100 rounded-xl sm:rounded-2xl text-red-600 shrink-0 shadow-inner">
            <AlertCircle size={24} className="sm:w-7 sm:h-7" />
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <h3 className="text-lg sm:text-xl font-black text-red-900 mb-1 sm:mb-2">Alerta de Estoque Baixo</h3>
            <p className="text-xs sm:text-sm text-red-700/80 font-medium mb-4 sm:mb-6 max-w-2xl">
              Atenção! Existem {stats.lowStock} {stats.lowStock === 1 ? 'item' : 'itens'} com quantidade crítica. Reponha seu estoque para evitar interrupções nos serviços.
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {lowStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="bg-white/80 backdrop-blur-sm border border-red-200 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 shadow-sm hover:scale-105 transition-transform">
                  <span className="text-[10px] sm:text-xs font-bold text-red-900">{item.name}</span>
                  <div className="h-3 sm:h-4 w-px bg-red-200" />
                  <span className="text-[8px] sm:text-[10px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg">
                    {item.quantity} / {item.minQuantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button 
            onClick={() => setActiveTab?.('inventory')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl sm:rounded-2xl font-bold text-sm hover:bg-red-700 active:scale-95 transition-all shrink-0 shadow-lg shadow-red-200 relative z-10"
          >
            <Package size={18} />
            Gerenciar Estoque
          </button>
          
          {/* Decorative background element */}
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-red-100/30 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {kpis.map((kpi, i) => (
          <div key={i} className="modern-card group !p-8 hover:translate-y-[-4px] transition-all duration-500">
            <div className="flex items-center justify-between mb-8">
              <div className={cn("p-5 rounded-2xl transition-all group-hover:scale-110 group-hover:rotate-3 duration-500 shadow-sm", kpi.bg)}>
                <kpi.icon size={32} className={cn("sm:w-8 sm:h-8", kpi.color)} />
              </div>
              <button 
                onClick={() => kpi.link && setActiveTab?.(kpi.link.replace('#', ''))}
                className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:text-accent group-hover:bg-accent/10 transition-all cursor-pointer active:scale-90"
              >
                <ArrowUpRight size={24} />
              </button>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">{kpi.label}</p>
              <h3 className="text-4xl sm:text-5xl font-black text-zinc-900 tracking-tight font-display">{kpi.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Sales Opportunities Widget */}
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
                <h4 className="text-5xl font-black text-zinc-900 font-display">{stats.hotLeads}</h4>
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
                <h4 className="text-5xl font-black text-zinc-900 font-display">{stats.proposalsInProgress}</h4>
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

      {/* Agenda Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
        {/* Daily Agenda Calendar Style */}
        <div className="lg:col-span-2 modern-card !p-10 sm:!p-16 group">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12">
            <div>
              <h3 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight font-display">Agenda do Dia</h3>
              <p className="text-base sm:text-lg text-zinc-500 font-medium mt-2">Compromissos agendados para hoje</p>
            </div>
            <button 
              onClick={() => setActiveTab?.('agenda')}
              className="flex items-center gap-3 px-6 py-3 bg-zinc-50 text-zinc-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-100 transition-all border border-zinc-100 shadow-sm group/btn"
            >
              Ver Agenda Completa
              <ArrowUpRight size={18} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
            </button>
          </div>

          <div className="space-y-8 max-h-[600px] overflow-y-auto pr-6 custom-scrollbar">
            {todayAppointmentsList.length > 0 ? (
              todayAppointmentsList.map((appointment) => (
                <div 
                  key={appointment.id} 
                  className="flex items-start gap-8 p-8 rounded-[2.5rem] border border-zinc-50 hover:border-accent/30 hover:bg-zinc-50/50 transition-all duration-500 group/item"
                >
                  <div className="flex flex-col items-center justify-center min-w-[80px] py-4 bg-zinc-50 text-zinc-900 rounded-3xl shadow-sm group-hover/item:bg-accent group-hover/item:text-accent-foreground transition-all duration-500">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                      {format(new Date(appointment.startTime), 'HH:mm')}
                    </span>
                    <div className="w-6 h-px bg-current opacity-20 my-2" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                      {format(new Date(appointment.endTime), 'HH:mm')}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xl font-black text-zinc-900 truncate group-hover/item:text-accent transition-colors font-display">
                        {clients[appointment.clienteId] || 'Cliente não encontrado'}
                      </h4>
                      <span className={cn(
                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border",
                        appointment.status === 'confirmed' ? "bg-green-50 text-green-600 border-green-100" :
                        appointment.status === 'cancelled' ? "bg-red-50 text-red-600 border-red-100" :
                        "bg-blue-50 text-blue-600 border-blue-100"
                      )}>
                        {appointment.status === 'confirmed' ? 'Confirmado' : 
                         appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-8 gap-y-3">
                      <div className="flex items-center gap-3 text-sm text-zinc-500 font-bold">
                        <div className="p-2 bg-zinc-100 rounded-xl group-hover/item:bg-white transition-colors">
                          <Car size={18} className="text-zinc-400" />
                        </div>
                        <span>
                          {vehicles[appointment.veiculoId || ''] ? 
                            `${vehicles[appointment.veiculoId || ''].brand} ${vehicles[appointment.veiculoId || ''].model} (${vehicles[appointment.veiculoId || ''].plate})` : 
                            'Veículo não encontrado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-zinc-500 font-bold">
                        <div className="p-2 bg-zinc-100 rounded-xl group-hover/item:bg-white transition-colors">
                          <ClipboardList size={18} className="text-zinc-400" />
                        </div>
                        <span className="truncate max-w-[300px]">
                          {appointment.servicoIds.map(id => services[id]).filter(Boolean).join(', ') || 'Nenhum serviço'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center bg-zinc-50/50 rounded-[3rem] border border-dashed border-zinc-200">
                <div className="p-8 bg-white rounded-3xl shadow-sm mb-6 group-hover:rotate-12 transition-transform duration-700">
                  <Calendar size={48} className="text-zinc-200" />
                </div>
                <h4 className="text-xl font-black text-zinc-900 mb-2 font-display">Nenhum agendamento para hoje</h4>
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Sua agenda está livre por enquanto.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-8 sm:space-y-10">
          <div className="modern-card !p-10 bg-zinc-900 text-white border-none shadow-2xl shadow-zinc-900/20 relative overflow-hidden group flex flex-col min-h-[450px]">
            <div className="relative z-10 flex-1">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-black tracking-tight font-display">Visão Geral</h3>
                <div className="p-4 bg-white/10 rounded-2xl group-hover:rotate-12 transition-transform duration-500">
                  <TrendingUp size={28} className="text-accent" />
                </div>
              </div>
              <div className="space-y-6">
                <div className="group/stat flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 rounded-[2rem] border border-white/5 transition-all duration-500">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/10 rounded-2xl text-white/40 group-hover/stat:text-accent transition-colors">
                      <Users size={24} />
                    </div>
                    <span className="text-sm font-black uppercase tracking-[0.2em]">Clientes</span>
                  </div>
                  <span className="text-3xl font-black font-display">{stats.totalClients}</span>
                </div>
                <div className="group/stat flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 rounded-[2rem] border border-white/5 transition-all duration-500">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/10 rounded-2xl text-white/40 group-hover/stat:text-accent transition-colors">
                      <Car size={24} />
                    </div>
                    <span className="text-sm font-black uppercase tracking-[0.2em]">Veículos</span>
                  </div>
                  <span className="text-3xl font-black font-display">{stats.totalVehicles}</span>
                </div>
              </div>
            </div>

            <div className="mt-12 p-10 bg-white/5 rounded-[2.5rem] text-white relative z-10 border border-white/5 group/sales">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-3">Vendas 7 Dias</p>
              <h4 className="text-4xl font-black tracking-tighter font-display group-hover/sales:text-accent transition-colors">{formatCurrency(stats.salesLast7Days)}</h4>
              <div className="flex items-center gap-3 text-[10px] font-black text-accent mt-6 bg-accent/10 px-4 py-2 rounded-2xl w-fit uppercase tracking-widest">
                <Sparkles size={14} />
                Crescimento Constante
              </div>
            </div>
            
            {/* Decorative background elements */}
            <div className="absolute -top-20 -left-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
          </div>

          <div className="modern-card !p-10 group">
            <h3 className="text-xl font-black text-zinc-900 mb-8 font-display">Atalhos Rápidos</h3>
            <div className="grid grid-cols-2 gap-5">
              {[
                { label: 'Nova OS', icon: Plus, link: '#os', color: 'bg-zinc-900 text-white hover:bg-accent hover:text-accent-foreground' },
                { label: 'Novo Lead', icon: UserPlus, link: '#leads', color: 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100' },
                { label: 'Financeiro', icon: DollarSign, link: '#finance', color: 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100' },
                { label: 'Estoque', icon: Package, link: '#inventory', color: 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab?.(action.link.replace('#', ''))}
                  className={cn(
                    "flex flex-col items-center justify-center gap-4 p-6 rounded-3xl transition-all duration-300 hover:translate-y-[-4px] active:scale-95 shadow-sm border border-zinc-100",
                    action.color
                  )}
                >
                  <div className="p-3 bg-current/10 rounded-xl">
                    <action.icon size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="modern-card !p-0 overflow-hidden group">
        <div className="p-10 sm:p-16 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-10">
            <div>
              <h3 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight font-display">Ordens de Serviço</h3>
              <p className="text-base sm:text-lg text-zinc-500 font-medium mt-2">Acompanhamento das Ordens de Serviço por data</p>
            </div>
            <div className="flex items-center gap-4 bg-zinc-50 px-6 py-3 rounded-2xl border border-zinc-100 shadow-sm focus-within:ring-2 focus-within:ring-accent/20 transition-all">
              <Calendar size={20} className="text-zinc-400" />
              <input 
                type="date" 
                className="bg-transparent border-none text-sm font-black text-zinc-700 focus:ring-0 p-0 uppercase tracking-widest"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
          <button 
            onClick={() => setActiveTab?.('os')}
            className="w-full sm:w-auto px-10 py-4 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all shadow-xl shadow-zinc-900/10"
          >
            Ver todas as OS
          </button>
        </div>
        
        {/* Mobile View: List of Cards */}
        <div className="block sm:hidden divide-y divide-zinc-100">
          {recentOS.length > 0 ? recentOS.map((os) => (
            <div key={os.id} className="p-8 space-y-6 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-black text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-xl">
                  #{os.id.slice(0, 8).toUpperCase()}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border",
                  ['em_execucao', 'aprovada'].includes(os.status) ? "bg-blue-50 text-blue-600 border-blue-100" : 
                  os.status === 'finalizada' ? "bg-green-50 text-green-600 border-green-100" :
                  os.status === 'cancelada' ? "bg-red-50 text-red-600 border-red-100" :
                  "bg-zinc-100 text-zinc-600 border border-zinc-200"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", ['em_execucao', 'aprovada'].includes(os.status) ? "bg-blue-600 animate-pulse" : os.status === 'finalizada' ? "bg-green-600" : os.status === 'cancelada' ? "bg-red-600" : "bg-zinc-400")} />
                  {os.status === 'em_execucao' ? 'Em Execução' : os.status === 'finalizada' ? 'Finalizado' : os.status === 'cancelada' ? 'Cancelado' : os.status === 'aprovada' ? 'Aprovada' : 'Aguardando'}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-accent/20">
                  {(clients[os.clienteId] || 'C').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-black text-zinc-900">{clients[os.clienteId] || `Cliente ${os.clienteId.slice(0, 4)}`}</span>
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Pessoa Física</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Abertura</span>
                  <span className="text-sm font-black text-zinc-600">{format(new Date(os.createdAt), 'dd/MM/yyyy')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Total</span>
                  <p className="text-lg font-black text-zinc-900 font-display">{formatCurrency(os.valorTotal)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4">
                <button 
                  onClick={() => handleUpdateStatus(os, 'em_execucao')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all",
                    os.status === 'em_execucao' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  )}
                >
                  <Clock size={16} />
                  Andamento
                </button>
                <button 
                  onClick={() => handleUpdateStatus(os, 'finalizada')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all",
                    os.status === 'finalizada' ? "bg-green-600 text-white shadow-lg shadow-green-600/20" : "bg-green-50 text-green-600 hover:bg-green-100"
                  )}
                >
                  <CheckCircle2 size={16} />
                  Finalizar
                </button>
                <button 
                  onClick={() => handleUpdateStatus(os, 'cancelada')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all",
                    os.status === 'cancelada' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "bg-red-50 text-red-600 hover:bg-red-100"
                  )}
                >
                  <XCircle size={16} />
                  Cancelar
                </button>
              </div>
            </div>
          )) : (
            <div className="p-16 text-center">
              <p className="text-xs text-zinc-400 font-black uppercase tracking-[0.3em]">Nenhuma OS para esta data</p>
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em]">
                <th className="px-12 py-8">Identificador</th>
                <th className="px-12 py-8">Cliente</th>
                <th className="px-12 py-8">Status Atual</th>
                <th className="px-12 py-8">Valor Total</th>
                <th className="px-12 py-8">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentOS.map((os) => (
                <tr key={os.id} className="group/row hover:bg-zinc-50/80 transition-all duration-300">
                  <td className="px-12 py-8">
                    <span className="font-mono text-[11px] font-black text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-xl group-hover/row:bg-white transition-colors">
                      #{os.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-12 py-8">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-accent/10 group-hover/row:scale-110 transition-transform">
                        {(clients[os.clienteId] || 'C').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-black text-zinc-900 group-hover/row:text-accent transition-colors">{clients[os.clienteId] || `Cliente ${os.clienteId.slice(0, 4)}`}</span>
                        <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Pessoa Física</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-12 py-8">
                    <span className={cn(
                      "inline-flex items-center gap-3 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border",
                      ['em_execucao', 'aprovada'].includes(os.status) ? "bg-blue-50 text-blue-600 border-blue-100" : 
                      os.status === 'finalizada' ? "bg-green-50 text-green-600 border-green-100" :
                      os.status === 'cancelada' ? "bg-red-50 text-red-600 border-red-100" :
                      "bg-zinc-100 text-zinc-600 border border-zinc-200"
                    )}>
                      <div className={cn("w-2 h-2 rounded-full", ['em_execucao', 'aprovada'].includes(os.status) ? "bg-blue-600 animate-pulse" : os.status === 'finalizada' ? "bg-green-600" : os.status === 'cancelada' ? "bg-red-600" : "bg-zinc-400")} />
                      {os.status === 'em_execucao' ? 'Em Execução' : os.status === 'finalizada' ? 'Finalizado' : os.status === 'cancelada' ? 'Cancelado' : os.status === 'aprovada' ? 'Aprovada' : 'Aguardando'}
                    </span>
                  </td>
                  <td className="px-12 py-8">
                    <span className="text-lg font-black text-zinc-900 font-display">{formatCurrency(os.valorTotal)}</span>
                  </td>
                  <td className="px-12 py-8">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleUpdateStatus(os, 'em_execucao')}
                        className={cn(
                          "p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95",
                          os.status === 'em_execucao' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        )}
                        title="Em Andamento"
                      >
                        <Clock size={20} />
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(os, 'finalizada')}
                        className={cn(
                          "p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95",
                          os.status === 'finalizada' ? "bg-green-600 text-white shadow-lg shadow-green-600/20" : "bg-green-50 text-green-600 hover:bg-green-100"
                        )}
                        title="Finalizar"
                      >
                        <CheckCircle2 size={20} />
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(os, 'cancelada')}
                        className={cn(
                          "p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95",
                          os.status === 'cancelada' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "bg-red-50 text-red-600 hover:bg-red-100"
                        )}
                        title="Cancelar"
                      >
                        <XCircle size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
