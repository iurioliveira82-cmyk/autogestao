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
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { formatCurrency, cn, handleFirestoreError } from '../lib/utils';
import { ServiceOrder, Transaction, Client, Vehicle, OperationType, OSStatus, Appointment, Lead, Proposal } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from './Auth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { generateAIResponse } from '../services/gemini';

interface DashboardProps {
  setActiveTab?: (tab: string, itemId?: string, supplierId?: string, itemStatus?: OSStatus) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { isAdmin, profile } = useAuth();
  const { canView } = usePermissions('dashboard');

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
    if (!profile) return;

    // Clients
    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setStats(prev => ({ ...prev, totalClients: snapshot.size }));
      const clientMap: Record<string, string> = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        clientMap[doc.id] = data.name;
      });
      setClients(clientMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'clients');
    });

    // Vehicles
    const unsubscribeVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      setStats(prev => ({ ...prev, totalVehicles: snapshot.size }));
      const vehicleMap: Record<string, Vehicle> = {};
      snapshot.forEach(doc => {
        vehicleMap[doc.id] = { id: doc.id, ...doc.data() } as Vehicle;
      });
      setVehicles(vehicleMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vehicles');
    });

    // Services
    const unsubscribeServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const serviceMap: Record<string, string> = {};
      snapshot.forEach(doc => {
        serviceMap[doc.id] = doc.data().name;
      });
      setServices(serviceMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'services');
    });

    // Resale Vehicles
    const unsubscribeResale = onSnapshot(collection(db, 'resaleVehicles'), (snapshot) => {
      setStats(prev => ({ ...prev, resaleVehicles: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'resaleVehicles');
    });

    // Average Ticket (from completed OS)
    const qCompletedOS = query(collection(db, 'serviceOrders'), where('status', '==', 'completed'));
    const unsubscribeCompletedOS = onSnapshot(qCompletedOS, (snapshot) => {
      let total = 0;
      snapshot.forEach(doc => {
        total += doc.data().totalValue || 0;
      });
      const avg = snapshot.size > 0 ? total / snapshot.size : 0;
      setStats(prev => ({ ...prev, averageTicket: avg }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'serviceOrders');
    });

    // Low Stock
    const unsubscribeStock = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      let low = 0;
      const items: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.quantity <= data.minQuantity) {
          low++;
          items.push({ id: doc.id, ...data });
        }
      });
      setStats(prev => ({ ...prev, lowStock: low }));
      setLowStockItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'inventory');
    });

    // Leads
    const unsubscribeLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
      const hot = snapshot.docs.filter(d => d.data().temperature === 'hot' && !['converted', 'lost'].includes(d.data().status)).length;
      setStats(prev => ({ ...prev, hotLeads: hot }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leads');
    });

    // Proposals
    const unsubscribeProposals = onSnapshot(collection(db, 'proposals'), (snapshot) => {
      const inProgress = snapshot.docs.filter(d => ['draft', 'sent'].includes(d.data().status)).length;
      setStats(prev => ({ ...prev, proposalsInProgress: inProgress }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'proposals');
    });

    return () => {
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeServices();
      unsubscribeResale();
      unsubscribeCompletedOS();
      unsubscribeStock();
      unsubscribeLeads();
      unsubscribeProposals();
    };
  }, [profile]);

  // Date-dependent data
  useEffect(() => {
    if (!profile) return;

    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    // Daily Transactions - Only for Admins
    let unsubscribeTransactions = () => {};
    if (isAdmin) {
      const qTransactions = query(
        collection(db, 'transactions'),
        where('date', '>=', start.toISOString()),
        where('date', '<=', end.toISOString())
      );

      unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
        let revenue = 0;
        let expense = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.type === 'in') revenue += data.value;
          else expense += data.value;
        });
        setStats(prev => ({ ...prev, dailyRevenue: revenue, dailyExpense: expense }));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      });
    }

    // Orders for selected date
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const startSelected = startOfDay(dateObj);
    const endSelected = endOfDay(dateObj);

    const qOS = query(
      collection(db, 'serviceOrders'),
      where('createdAt', '>=', startSelected.toISOString()),
      where('createdAt', '<=', endSelected.toISOString()),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeOS = onSnapshot(qOS, (snapshot) => {
      setStats(prev => ({ ...prev, activeOS: snapshot.docs.filter(d => ['waiting', 'in-progress'].includes(d.data().status)).length }));
      const osList: ServiceOrder[] = [];
      snapshot.forEach(doc => osList.push({ id: doc.id, ...doc.data() } as ServiceOrder));
      setRecentOS(osList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'serviceOrders');
    });

    // Today's Appointments
    const qAppointments = query(
      collection(db, 'appointments'),
      where('startTime', '>=', start.toISOString()),
      where('startTime', '<=', end.toISOString())
    );

    const unsubscribeAppointments = onSnapshot(qAppointments, (snapshot) => {
      setStats(prev => ({ ...prev, todayAppointments: snapshot.size }));
      const appointments: Appointment[] = [];
      snapshot.forEach(doc => appointments.push({ id: doc.id, ...doc.data() } as Appointment));
      setTodayAppointmentsList(appointments.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'appointments');
    });

    // Chart Data (Last 7 days) - Real-time
    let unsubscribeChart = () => {};
    if (isAdmin) {
      const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
      const qChart = query(
        collection(db, 'transactions'),
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
  }, [profile, isAdmin, selectedDate]);

  const handleUpdateStatus = async (os: ServiceOrder, newStatus: OSStatus) => {
    try {
      if (newStatus === 'finished' || newStatus === 'confirmed') {
        if (setActiveTab) {
          setActiveTab('os', os.id, undefined, newStatus);
          return;
        }
      }

      if (os.status === 'finished') {
        toast.error('Ordens de serviço finalizadas não podem ser alteradas.');
        return;
      }

      const osRef = doc(db, 'serviceOrders', os.id);
      await updateDoc(osRef, { 
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // If finished, we should ideally trigger the same logic as ServiceOrders.tsx
      // For simplicity and consistency, let's just update the status here
      // and maybe inform the user that full finalization should be done in the OS tab
      // OR we can implement the basic transaction creation here too.
      
      if (newStatus === 'finished') {
        // Basic transaction creation for cash payments
        if (os.paymentType === 'cash') {
          await addDoc(collection(db, 'transactions'), {
            type: 'in',
            value: os.totalValue,
            category: 'Serviço',
            description: `OS #${os.id.slice(0, 6)} - ${clients[os.clientId] || 'Cliente'}`,
            date: new Date().toISOString(),
            status: 'paid',
            paymentMethod: os.paymentMethod || 'pix',
            relatedOSId: os.id,
            clientId: os.clientId
          });
        } else if (os.paymentType === 'deferred') {
          await addDoc(collection(db, 'transactions'), {
            type: 'in',
            value: os.totalValue,
            category: 'Serviço',
            description: `OS #${os.id.slice(0, 6)} - ${clients[os.clientId] || 'Cliente'}`,
            date: new Date().toISOString(),
            dueDate: os.dueDate || new Date().toISOString(),
            status: 'pending',
            paymentMethod: os.paymentMethod || 'pix',
            relatedOSId: os.id,
            clientId: os.clientId
          });
        }

        toast.success('OS finalizada e transação financeira criada!');
      } else {
        toast.success(`Status da OS alterado para ${newStatus === 'in-progress' ? 'Em Andamento' : 'Cancelado'}`);
      }
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
    <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-zinc-500 font-medium">Bem-vindo de volta ao seu painel de controle.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateAIAnalysis}
            disabled={isGeneratingAI}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 disabled:opacity-50"
          >
            {isGeneratingAI ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} className="text-amber-400" />
            )}
            Análise de IA
          </button>
          <div className="px-4 py-2 bg-white border border-zinc-200 rounded-2xl flex items-center gap-2 shadow-sm">
            <Calendar size={16} className="text-zinc-400" />
            <span className="text-sm font-bold text-zinc-600">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</span>
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
            className="bg-zinc-900 text-white p-6 sm:p-8 rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden group"
          >
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Sparkles size={20} className="text-amber-400" />
                </div>
                <h3 className="text-lg font-bold">Insights da Inteligência Artificial</h3>
              </div>
              <button 
                onClick={() => setAiAnalysis(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle size={20} className="text-zinc-500" />
              </button>
            </div>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed relative z-10 italic">
              "{aiAnalysis}"
            </p>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
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
            onClick={() => window.location.hash = '#inventory'}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-zinc-200 shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className={cn("p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-transform group-hover:scale-110 duration-300 shadow-sm", kpi.bg)}>
                <kpi.icon size={24} className={cn("sm:w-7 sm:h-7", kpi.color)} />
              </div>
              <button 
                onClick={() => kpi.link && (window.location.hash = kpi.link)}
                className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:text-zinc-900 group-hover:bg-zinc-100 transition-all cursor-pointer active:scale-90"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 sm:mb-2">{kpi.label}</p>
              <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">{kpi.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Sales Opportunities Widget */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden relative group">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Oportunidades de Vendas</h3>
            <p className="text-xs sm:text-sm text-zinc-500 font-medium">Resumo de leads e propostas ativas</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 flex items-center gap-2">
              <Sparkles size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Foco em Conversão</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 flex items-center justify-between group/card hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl group-hover/card:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Leads Quentes</p>
                <h4 className="text-3xl font-black text-zinc-900">{stats.hotLeads}</h4>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg uppercase tracking-widest">Prioridade Alta</span>
            </div>
          </div>

          <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 flex items-center justify-between group/card hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl group-hover/card:scale-110 transition-transform">
                <ClipboardList size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Propostas em Andamento</p>
                <h4 className="text-3xl font-black text-zinc-900">{stats.proposalsInProgress}</h4>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-widest">Aguardando Resposta</span>
            </div>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-zinc-50 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
      </div>

      {/* Agenda Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Daily Agenda Calendar Style */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-10">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Agenda do Dia</h3>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium">Compromissos agendados para hoje</p>
            </div>
            <button 
              onClick={() => window.location.hash = '#agenda'}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all"
            >
              Ver Agenda Completa
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {todayAppointmentsList.length > 0 ? (
              todayAppointmentsList.map((appointment) => (
                <div 
                  key={appointment.id} 
                  className="flex items-start gap-4 p-4 rounded-2xl border border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50 transition-all group"
                >
                  <div className="flex flex-col items-center justify-center min-w-[60px] py-2 bg-zinc-900 text-white rounded-xl shadow-sm">
                    <span className="text-xs font-black uppercase tracking-tighter">
                      {format(new Date(appointment.startTime), 'HH:mm')}
                    </span>
                    <div className="w-4 h-px bg-white/20 my-1" />
                    <span className="text-[10px] font-bold text-zinc-400">
                      {format(new Date(appointment.endTime), 'HH:mm')}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-black text-zinc-900 truncate">
                        {clients[appointment.clientId] || 'Cliente não encontrado'}
                      </h4>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                        appointment.status === 'confirmed' ? "bg-green-50 text-green-600" :
                        appointment.status === 'cancelled' ? "bg-red-50 text-red-600" :
                        "bg-blue-50 text-blue-600"
                      )}>
                        {appointment.status === 'confirmed' ? 'Confirmado' : 
                         appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                        <Car size={12} className="text-zinc-400" />
                        <span>
                          {vehicles[appointment.vehicleId] ? 
                            `${vehicles[appointment.vehicleId].brand} ${vehicles[appointment.vehicleId].model} (${vehicles[appointment.vehicleId].plate})` : 
                            'Veículo não encontrado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                        <ClipboardList size={12} className="text-zinc-400" />
                        <span className="truncate max-w-[200px]">
                          {appointment.serviceIds.map(id => services[id]).filter(Boolean).join(', ') || 'Nenhum serviço'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                  <Calendar size={32} className="text-zinc-300" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900 mb-1">Nenhum agendamento para hoje</h4>
                <p className="text-xs text-zinc-500">Sua agenda está livre por enquanto.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-zinc-900 text-white p-6 sm:p-10 rounded-2xl sm:rounded-[2.5rem] shadow-2xl shadow-zinc-300 relative overflow-hidden flex flex-col">
          <div className="relative z-10 flex-1">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">Visão Geral</h3>
              <div className="p-2 bg-white/10 rounded-xl">
                <TrendingUp size={18} className="text-green-400 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="group flex items-center justify-between p-4 sm:p-5 bg-white/5 hover:bg-white/10 rounded-2xl sm:rounded-[1.5rem] border border-white/5 transition-all duration-300">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-white/10 rounded-xl text-zinc-400 group-hover:text-white transition-colors">
                    <Users size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold tracking-wide">Total de Clientes</span>
                </div>
                <span className="text-lg sm:text-xl font-black">{stats.totalClients}</span>
              </div>
              <div className="group flex items-center justify-between p-4 sm:p-5 bg-white/5 hover:bg-white/10 rounded-2xl sm:rounded-[1.5rem] border border-white/5 transition-all duration-300">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-white/10 rounded-xl text-zinc-400 group-hover:text-white transition-colors">
                    <Car size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold tracking-wide">Veículos Cadastrados</span>
                </div>
                <span className="text-lg sm:text-xl font-black">{stats.totalVehicles}</span>
              </div>
              <div className="group flex items-center justify-between p-4 sm:p-5 bg-white/5 hover:bg-white/10 rounded-2xl sm:rounded-[1.5rem] border border-white/5 transition-all duration-300">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-white/10 rounded-xl text-zinc-400 group-hover:text-white transition-colors">
                    <Calendar size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-bold tracking-wide">Agenda</span>
                </div>
                <span className="text-lg sm:text-xl font-black">{stats.todayAppointments}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 sm:mt-10 p-6 sm:p-8 bg-white rounded-2xl sm:rounded-[2rem] text-zinc-900 relative z-10 shadow-xl">
            <p className="text-[8px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1 sm:mb-2">Vendas Últimos 7 Dias</p>
            <h4 className="text-2xl sm:text-4xl font-black tracking-tighter">{formatCurrency(stats.salesLast7Days)}</h4>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-green-600 mt-3 sm:mt-4 bg-green-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg w-fit">
              <TrendingUp size={12} className="sm:w-3.5 sm:h-3.5" />
              Crescimento Constante
            </div>
          </div>
          
          {/* Decorative background elements */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-zinc-800 rounded-full blur-3xl" />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-10 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Ordens de Serviço</h3>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium">Acompanhamento das Ordens de Serviço por data</p>
            </div>
            <div className="flex items-center gap-2 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-100">
              <Calendar size={14} className="text-zinc-400" />
              <input 
                type="date" 
                className="bg-transparent border-none text-xs font-bold text-zinc-600 focus:ring-0 p-0"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
          <button 
            onClick={() => window.location.hash = '#os'}
            className="w-full sm:w-auto px-6 py-2.5 bg-zinc-100 text-zinc-900 rounded-xl sm:rounded-2xl text-sm font-bold hover:bg-zinc-200 active:scale-95 transition-all"
          >
            Ver todas as OS
          </button>
        </div>
        
        {/* Mobile View: List of Cards */}
        <div className="block sm:hidden divide-y divide-zinc-100">
          {recentOS.length > 0 ? recentOS.map((os) => (
            <div key={os.id} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded-md">
                  #{os.id.slice(0, 8).toUpperCase()}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                  os.status === 'in-progress' ? "bg-blue-50 text-blue-600 border border-blue-100" : 
                  os.status === 'finished' ? "bg-green-50 text-green-600 border border-green-100" :
                  os.status === 'cancelled' ? "bg-red-50 text-red-600 border border-red-100" :
                  "bg-zinc-100 text-zinc-600 border border-zinc-200"
                )}>
                  <div className={cn("w-1 h-1 rounded-full", os.status === 'in-progress' ? "bg-blue-600 animate-pulse" : os.status === 'finished' ? "bg-green-600" : os.status === 'cancelled' ? "bg-red-600" : "bg-zinc-400")} />
                  {os.status === 'in-progress' ? 'Em Execução' : os.status === 'finished' ? 'Finalizado' : os.status === 'cancelled' ? 'Cancelado' : 'Aguardando'}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center font-black text-xs">
                  {(clients[os.clientId] || 'C').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-zinc-900">{clients[os.clientId] || `Cliente ${os.clientId.slice(0, 4)}`}</span>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Pessoa Física</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Abertura</span>
                  <span className="text-xs font-bold text-zinc-600">{format(new Date(os.createdAt), 'dd/MM/yyyy')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Total</span>
                  <p className="text-sm font-black text-zinc-900">{formatCurrency(os.totalValue)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <button 
                  onClick={() => handleUpdateStatus(os, 'in-progress')}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl text-[8px] font-bold uppercase transition-all",
                    os.status === 'in-progress' ? "bg-blue-600 text-white shadow-md" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  )}
                >
                  <Clock size={14} />
                  Andamento
                </button>
                <button 
                  onClick={() => handleUpdateStatus(os, 'finished')}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl text-[8px] font-bold uppercase transition-all",
                    os.status === 'finished' ? "bg-green-600 text-white shadow-md" : "bg-green-50 text-green-600 hover:bg-green-100"
                  )}
                >
                  <CheckCircle2 size={14} />
                  Finalizar
                </button>
                <button 
                  onClick={() => handleUpdateStatus(os, 'cancelled')}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl text-[8px] font-bold uppercase transition-all",
                    os.status === 'cancelled' ? "bg-red-600 text-white shadow-md" : "bg-red-50 text-red-600 hover:bg-red-100"
                  )}
                >
                  <XCircle size={14} />
                  Cancelar
                </button>
              </div>
            </div>
          )) : (
            <div className="p-10 text-center">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Nenhuma OS para esta data</p>
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-10 py-5">Identificador</th>
                <th className="px-10 py-5">Cliente</th>
                <th className="px-10 py-5">Status Atual</th>
                <th className="px-10 py-5">Valor Total</th>
                <th className="px-10 py-5">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentOS.map((os) => (
                <tr key={os.id} className="group hover:bg-zinc-50/80 transition-all duration-200">
                  <td className="px-10 py-6">
                    <span className="font-mono text-[11px] font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded-md group-hover:bg-white transition-colors">
                      #{os.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-sm">
                        {(clients[os.clientId] || 'C').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-zinc-900">{clients[os.clientId] || `Cliente ${os.clientId.slice(0, 4)}`}</span>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Pessoa Física</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className={cn(
                      "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm",
                      os.status === 'in-progress' ? "bg-blue-50 text-blue-600 border border-blue-100" : 
                      os.status === 'finished' ? "bg-green-50 text-green-600 border border-green-100" :
                      os.status === 'cancelled' ? "bg-red-50 text-red-600 border border-red-100" :
                      "bg-zinc-100 text-zinc-600 border border-zinc-200"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", os.status === 'in-progress' ? "bg-blue-600 animate-pulse" : os.status === 'finished' ? "bg-green-600" : os.status === 'cancelled' ? "bg-red-600" : "bg-zinc-400")} />
                      {os.status === 'in-progress' ? 'Em Execução' : os.status === 'finished' ? 'Finalizado' : os.status === 'cancelled' ? 'Cancelado' : 'Aguardando'}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <span className="text-sm font-black text-zinc-900">{formatCurrency(os.totalValue)}</span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleUpdateStatus(os, 'in-progress')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          os.status === 'in-progress' ? "bg-blue-600 text-white shadow-md" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        )}
                        title="Em Andamento"
                      >
                        <Clock size={16} />
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(os, 'finished')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          os.status === 'finished' ? "bg-green-600 text-white shadow-md" : "bg-green-50 text-green-600 hover:bg-green-100"
                        )}
                        title="Finalizar"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(os, 'cancelled')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          os.status === 'cancelled' ? "bg-red-600 text-white shadow-md" : "bg-red-50 text-red-600 hover:bg-red-100"
                        )}
                        title="Cancelar"
                      >
                        <XCircle size={16} />
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
