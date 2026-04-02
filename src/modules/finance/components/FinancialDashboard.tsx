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
import { formatCurrency, cn, handleFirestoreError } from '../../../utils';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../auth/Auth';
import { Card } from '../../../components/ui/Card';
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

    const goal = monthlyGoals.find(g => g.id === format(now, 'yyyy-MM'));

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
      const monthStr = format(date, 'MMM', { locale: ptBR });
      const monthKey = format(date, 'yyyy-MM');
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
          <Card key={idx} className="p-6 hover:shadow-md transition-all">
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
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-lg font-black text-slate-900">Desempenho Financeiro</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Últimos 6 meses</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
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
        </Card>

        {/* Goals Progress */}
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-accent/10 text-accent rounded-2xl">
              <Target size={24} />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900">Metas do Mês</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Progresso Atual</p>
            </div>
          </div>

          <div className="space-y-8">
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
        </Card>
      </div>

      {/* OS Margin Analysis */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100">
          <h4 className="text-lg font-black text-slate-900">Rentabilidade por OS</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Análise de Margem de Contribuição</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-8 py-4">OS</th>
                <th className="px-8 py-4 text-right">Faturamento</th>
                <th className="px-8 py-4 text-right">Custo</th>
                <th className="px-8 py-4 text-right">Lucro</th>
                <th className="px-8 py-4 text-right">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {serviceOrders
                .filter(os => os.status === 'finalizada')
                .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
                .slice(0, 5)
                .map((os) => {
                  const revenue = os.valorTotal || 0;
                  const cost = os.custoTotal || 0;
                  const profit = revenue - cost;
                  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                  return (
                    <tr key={os.id} className="hover:bg-slate-50 transition-all group">
                      <td className="px-8 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">OS #{os.numeroOS || os.id.slice(-4).toUpperCase()}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {format(new Date(os.updatedAt || os.createdAt), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(revenue)}</td>
                      <td className="px-8 py-4 text-right text-sm font-bold text-red-500">{formatCurrency(cost)}</td>
                      <td className="px-8 py-4 text-right text-sm font-black text-green-600">{formatCurrency(profit)}</td>
                      <td className="px-8 py-4 text-right">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {Math.round(margin)}%
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
