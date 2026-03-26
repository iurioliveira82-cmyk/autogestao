import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Car, 
  ClipboardList, 
  Calendar, 
  DollarSign, 
  Package, 
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { formatCurrency, cn } from '../lib/utils';
import { ServiceOrder, Transaction, Client, Vehicle, OperationType } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from './Auth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
  const { isAdmin, profile } = useAuth();
  const { canView } = usePermissions('dashboard');

  const handleFirestoreError = (error: any, operation: OperationType, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType: operation,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    if (error?.message?.includes('permission')) {
      toast.error(`Erro de permissão ao acessar: ${path}`);
    }
    throw new Error(JSON.stringify(errInfo));
  };
  const [stats, setStats] = useState({
    dailyRevenue: 0,
    dailyExpense: 0,
    activeOS: 0,
    todayAppointments: 0,
    totalClients: 0,
    totalVehicles: 0,
    lowStock: 0,
    resaleVehicles: 0,
    averageTicket: 0
  });

  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [recentOS, setRecentOS] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;

    // Real-time stats
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

    // Active OS
    const qOS = query(
      collection(db, 'serviceOrders'),
      where('status', 'in', ['waiting', 'in-progress'])
    );

    const unsubscribeOS = onSnapshot(qOS, (snapshot) => {
      setStats(prev => ({ ...prev, activeOS: snapshot.size }));
      const osList: ServiceOrder[] = [];
      snapshot.forEach(doc => osList.push({ id: doc.id, ...doc.data() } as ServiceOrder));
      setRecentOS(osList.slice(0, 5));
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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'appointments');
    });

    // Total Clients
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

    // Total Vehicles
    const unsubscribeVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      setStats(prev => ({ ...prev, totalVehicles: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vehicles');
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
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.quantity <= data.minQuantity) low++;
      });
      setStats(prev => ({ ...prev, lowStock: low }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'inventory');
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
            if (data.type === 'in') days[dateKey].revenue += data.value;
            else days[dateKey].expense += data.value;
          }
        });

        const chartData = Object.values(days).map(d => ({
          ...d,
          profit: d.revenue - d.expense
        }));
        
        setRevenueData(chartData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions_chart');
      });
    }

    return () => {
      unsubscribeTransactions();
      unsubscribeOS();
      unsubscribeAppointments();
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeStock();
      unsubscribeResale();
      unsubscribeCompletedOS();
      unsubscribeChart();
    };
  }, [profile, isAdmin]);

  const kpis = [
    { label: 'Lucro Hoje', value: formatCurrency(stats.dailyRevenue - stats.dailyExpense), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'OS em Aberto', value: stats.activeOS, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Agenda Hoje', value: stats.todayAppointments, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Estoque Baixo', value: stats.lowStock, icon: AlertCircle, color: stats.lowStock > 0 ? 'text-red-600' : 'text-zinc-400', bg: stats.lowStock > 0 ? 'bg-red-50' : 'bg-zinc-50' },
  ];

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
    <div className="space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", kpi.bg)}>
                <kpi.icon size={24} className={kpi.color} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500 mb-1">{kpi.label}</p>
              <h3 className="text-2xl font-bold text-zinc-900">{kpi.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Faturamento Semanal</h3>
              <p className="text-sm text-zinc-500">Desempenho dos últimos 7 dias</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs font-medium text-zinc-500">
                <div className="w-2 h-2 bg-zinc-900 rounded-full" />
                Receita
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-zinc-500">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Lucro
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a1a1aa', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  tickFormatter={(value) => `R$${value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8f8f8' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill="#18181b" radius={[6, 6, 0, 0]} barSize={30} />
                <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-zinc-900 text-white p-8 rounded-3xl shadow-xl shadow-zinc-200 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-6">Visão Geral</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-zinc-400" />
                  <span className="text-sm font-medium">Total de Clientes</span>
                </div>
                <span className="text-lg font-bold">{stats.totalClients}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-3">
                  <Car size={20} className="text-zinc-400" />
                  <span className="text-sm font-medium">Veículos Cadastrados</span>
                </div>
                <span className="text-lg font-bold">{stats.totalVehicles}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-3">
                  <ShoppingBag size={20} className="text-zinc-400" />
                  <span className="text-sm font-medium">Veículos p/ Revenda</span>
                </div>
                <span className="text-lg font-bold">{stats.resaleVehicles}</span>
              </div>
            </div>

            <div className="mt-10 p-6 bg-white rounded-2xl text-zinc-900">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Ticket Médio</p>
              <h4 className="text-3xl font-bold">{formatCurrency(stats.averageTicket)}</h4>
              <div className="flex items-center gap-1 text-xs font-bold text-green-500 mt-2">
                <TrendingUp size={12} />
                Baseado em OS finalizadas
              </div>
            </div>
          </div>
          
          {/* Decorative element */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">Serviços em Andamento</h3>
            <p className="text-sm text-zinc-500">Acompanhamento em tempo real das OS</p>
          </div>
          <button className="text-sm font-bold text-zinc-900 hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-4">ID</th>
                <th className="px-8 py-4">Cliente</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Valor</th>
                <th className="px-8 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentOS.length > 0 ? recentOS.map((os) => (
                <tr key={os.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-8 py-5 font-mono text-xs text-zinc-400">#{os.id.slice(0, 6)}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-600 font-bold text-xs">
                        {(clients[os.clientId] || 'C').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-zinc-900">{clients[os.clientId] || `Cliente ${os.clientId.slice(0, 4)}`}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                      os.status === 'in-progress' ? "bg-blue-50 text-blue-600" : "bg-zinc-50 text-zinc-600"
                    )}>
                      {os.status === 'in-progress' ? <Clock size={12} /> : <AlertCircle size={12} />}
                      {os.status === 'in-progress' ? 'Em Andamento' : 'Aguardando'}
                    </span>
                  </td>
                  <td className="px-8 py-5 font-bold text-zinc-900">{formatCurrency(os.totalValue)}</td>
                  <td className="px-8 py-5 text-sm text-zinc-500">{format(new Date(os.createdAt), 'dd/MM/yyyy')}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-zinc-400 italic">Nenhuma OS em andamento no momento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
