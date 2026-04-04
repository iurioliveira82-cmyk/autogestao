import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Users, 
  FileText,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Percent
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { FinancialTransaction, ServiceOrder, MonthlyGoal, Commission, OperationType } from '../../../types';
import { formatCurrency, cn, handleFirestoreError, formatSafeDate } from '../../../utils';
import { startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../auth/Auth';
import { AppCard } from '../../../components/ui/AppCard';
import SectionCard from '../../../components/layout/SectionCard';
import { DataTable } from '../../../components/ui/DataTable';
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

const FinancialDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.empresaId) return;

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transacoes_financeiras'), where('empresaId', '==', profile.empresaId)),
      (snapshot) => {
        const list: FinancialTransaction[] = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as FinancialTransaction));
        setTransactions(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'transacoes_financeiras')
    );

    const unsubOS = onSnapshot(
      query(collection(db, 'ordens_servico'), where('empresaId', '==', profile.empresaId)),
      (snapshot) => {
        const list: ServiceOrder[] = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ServiceOrder));
        setServiceOrders(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'ordens_servico')
    );

    const unsubGoals = onSnapshot(
      query(collection(db, 'metas_mensais'), where('empresaId', '==', profile.empresaId)),
      (snapshot) => {
        const list: MonthlyGoal[] = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as MonthlyGoal));
        setMonthlyGoals(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'metas_mensais')
    );

    const unsubCommissions = onSnapshot(
      query(collection(db, 'comissoes'), where('empresaId', '==', profile.empresaId)),
      (snapshot) => {
        const list: Commission[] = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Commission));
        setCommissions(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'comissoes')
    );

    setLoading(false);

    return () => {
      unsubTransactions();
      unsubOS();
      unsubGoals();
      unsubCommissions();
    };
  }, [profile]);

  const currentMonth = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    const monthTransactions = transactions.filter(t => {
      if (!t.date) return false;
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return false;
      return isWithinInterval(date, { start, end }) && t.status === 'paid';
    });

    const income = monthTransactions.filter(t => t.type === 'in').reduce((acc, t) => acc + t.value, 0);
    const expense = monthTransactions.filter(t => t.type === 'out').reduce((acc, t) => acc + t.value, 0);
    
    const monthOS = serviceOrders.filter(os => {
      const dateStr = os.updatedAt || os.createdAt;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;
      return isWithinInterval(date, { start, end }) && os.status === 'finalizada';
    });

    const osCount = monthOS.length;
    const grossRevenue = monthOS.reduce((acc, os) => acc + (os.valorTotal || 0), 0);
    const ticketMedio = osCount > 0 ? grossRevenue / osCount : 0;

    const goal = monthlyGoals.find(g => g.id === formatSafeDate(now, 'yyyy-MM'));

    return {
      income,
      expense,
      profit: income - expense,
      osCount,
      ticketMedio,
      goal
    };
  }, [transactions, serviceOrders, monthlyGoals]);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStr = formatSafeDate(date, 'MMM');
      const monthKey = formatSafeDate(date, 'yyyy-MM');
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const monthTransactions = transactions.filter(t => {
        if (!t.date) return false;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return false;
        return isWithinInterval(d, { start, end }) && t.status === 'paid';
      });

      const income = monthTransactions.filter(t => t.type === 'in').reduce((acc, t) => acc + t.value, 0);
      const expense = monthTransactions.filter(t => t.type === 'out').reduce((acc, t) => acc + t.value, 0);

      data.push({
        name: monthStr,
        income,
        expense,
        profit: income - expense
      });
    }
    return data;
  }, [transactions]);

  const stats = [
    {
      label: 'Faturamento Mensal',
      value: formatCurrency(currentMonth.income),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      trend: currentMonth.goal ? `${Math.round((currentMonth.income / currentMonth.goal.faturamento) * 100)}% da meta` : 'Sem meta'
    },
    {
      label: 'Lucro Líquido',
      value: formatCurrency(currentMonth.profit),
      icon: DollarSign,
      color: 'text-accent',
      bg: 'bg-accent/10',
      trend: currentMonth.income > 0 ? `${Math.round((currentMonth.profit / currentMonth.income) * 100)}% de margem` : '0% de margem'
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(currentMonth.ticketMedio),
      icon: Percent,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      trend: `${currentMonth.osCount} OS finalizadas`
    },
    {
      label: 'Inadimplência',
      value: formatCurrency(transactions.filter(t => {
        if (!t.dueDate || t.status !== 'pending' || t.type !== 'in') return false;
        const d = new Date(t.dueDate);
        return !isNaN(d.getTime()) && d < new Date();
      }).reduce((acc, t) => acc + t.value, 0)),
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      trend: 'Total vencido'
    }
  ];

  if (loading) return <div className="p-8 text-center text-slate-400 italic">Carregando dashboard...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <AppCard key={idx} className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg, stat.color)}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className={cn("text-xl font-black", stat.color)}>{stat.value}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{stat.trend}</p>
            </div>
          </AppCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <SectionCard 
          title="Desempenho Financeiro" 
          subtitle="Últimos 6 meses"
          className="lg:col-span-2"
        >
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#a1a1aa' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#a1a1aa' }}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Goals Progress */}
        <SectionCard 
          title="Metas do Mês" 
          subtitle="Progresso Atual"
          icon={<Target size={20} className="text-accent" />}
        >
          <div className="space-y-8 mt-4">
            {currentMonth.goal ? (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Faturamento</span>
                    <span className="text-slate-900">{Math.round((currentMonth.income / currentMonth.goal.faturamento) * 100)}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (currentMonth.income / currentMonth.goal.faturamento) * 100)}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium text-right">
                    {formatCurrency(currentMonth.income)} / {formatCurrency(currentMonth.goal.faturamento)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Lucro Líquido</span>
                    <span className="text-slate-900">{Math.round((currentMonth.profit / currentMonth.goal.lucroLiquido) * 100)}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (currentMonth.profit / currentMonth.goal.lucroLiquido) * 100)}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium text-right">
                    {formatCurrency(currentMonth.profit)} / {formatCurrency(currentMonth.goal.lucroLiquido)}
                  </p>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400 italic">Nenhuma meta definida para este mês.</p>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* OS Margin Analysis */}
      <SectionCard 
        title="Rentabilidade por OS" 
        subtitle="Análise de Margem de Contribuição"
      >
        <DataTable
          columns={[
            { header: 'OS', accessor: (os) => (
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">OS #{os.numeroOS || os.id.slice(-4).toUpperCase()}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {formatSafeDate(os.updatedAt || os.createdAt, 'dd/MM/yyyy')}
                </span>
              </div>
            )},
            { header: 'Faturamento', className: 'text-right', accessor: (os) => (
              <span className="text-sm font-bold text-slate-900">{formatCurrency(os.valorTotal || 0)}</span>
            )},
            { header: 'Custo', className: 'text-right', accessor: (os) => (
              <span className="text-sm font-bold text-red-500">{formatCurrency(os.custoTotal || 0)}</span>
            )},
            { header: 'Lucro', className: 'text-right', accessor: (os) => (
              <span className="text-sm font-black text-green-600">{formatCurrency((os.valorTotal || 0) - (os.custoTotal || 0))}</span>
            )},
            { header: 'Margem', className: 'text-right', accessor: (os) => {
              const revenue = os.valorTotal || 0;
              const cost = os.custoTotal || 0;
              const profit = revenue - cost;
              const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
              return (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {Math.round(margin)}%
                </div>
              );
            }}
          ]}
          data={serviceOrders
            .filter(os => os.status === 'finalizada')
            .sort((a, b) => {
              const dateA = (a.updatedAt || a.createdAt)?.seconds ? (a.updatedAt || a.createdAt).seconds * 1000 : new Date(a.updatedAt || a.createdAt).getTime();
              const dateB = (b.updatedAt || b.createdAt)?.seconds ? (b.updatedAt || b.createdAt).seconds * 1000 : new Date(b.updatedAt || b.createdAt).getTime();
              return (dateB || 0) - (dateA || 0);
            })
            .slice(0, 5)}
          emptyMessage="Nenhuma OS finalizada encontrada."
        />
      </SectionCard>
    </div>
  );
};

export default FinancialDashboard;
