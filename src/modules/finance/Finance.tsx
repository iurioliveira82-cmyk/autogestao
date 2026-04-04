import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  Calendar,
  PieChart as PieChartIcon,
  Download,
  XCircle,
  Printer,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ArrowDownCircle,
  LayoutDashboard,
  Tags,
  Repeat,
  Users,
  Lock,
  List,
  ArrowRight
} from 'lucide-react';
import { Transaction, Supplier, OperationType, ServiceOrder, Client } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../auth/Auth';
import { formatCurrency, cn, formatSafeDate } from '../../utils';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

// UI Components
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AppDialog } from '../../components/ui/AppDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

// Hooks
import { useFinance } from '../../hooks/useFinance';
import { useClients } from '../../hooks/useClients';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useServiceOrders } from '../../hooks/useServiceOrders';

// New Components
import FinancialDashboard from './components/FinancialDashboard';
import CostCenterManager from './components/CostCenterManager';
import RecurringTransactions from './components/RecurringTransactions';
import CommissionsManager from './components/CommissionsManager';
import DailyClosingManager from './components/DailyClosingManager';

interface FinanceProps {
  setActiveTab?: (tab: string, itemId?: string) => void;
}

const Finance: React.FC<FinanceProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions('finance');

  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'paid' | 'pending' | 'cancelled',
    type: 'all' as 'all' | 'in' | 'out',
    searchTerm: '',
    relatedId: 'all',
    supplierId: 'all',
    clientId: 'all',
    startDate: '',
    endDate: '',
    startDueDate: '',
    endDueDate: ''
  });

  const { 
    transactions, 
    loading: financeLoading, 
    addTransaction, 
    updateTransaction, 
    deleteTransaction,
    refresh 
  } = useFinance(filters);

  const { clients } = useClients(profile?.empresaId);
  const { suppliers } = useSuppliers(profile?.empresaId);
  const { serviceOrders } = useServiceOrders(profile?.empresaId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [relatedOS, setRelatedOS] = useState<ServiceOrder | null>(null);
  const [chartView, setChartView] = useState<'general' | 'income' | 'expense'>('general');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    title: '',
    message: '',
    confirmLabel: '',
    onConfirm: () => {}
  });

  const [activeSubTab, setActiveSubTab] = useState<'transactions' | 'dashboard' | 'cost-centers' | 'recurring' | 'commissions' | 'closing'>('transactions');
  const [financeTab, setFinanceTab] = useState<'all' | 'receivable' | 'payable'>(() => {
    const saved = localStorage.getItem('financeTab');
    if (saved === 'receivable' || saved === 'payable' || saved === 'all') return saved;
    return 'all';
  });

  const handleSetFinanceTab = (tab: 'all' | 'receivable' | 'payable') => {
    setFinanceTab(tab);
    localStorage.setItem('financeTab', tab);
  };

  const calculateInterest = (t: Transaction) => {
    if (t.status !== 'pending' || !t.dueDate) return 0;
    const dueDate = new Date(t.dueDate);
    const today = new Date();
    if (dueDate >= today) return 0;
    
    const daysOverdue = differenceInDays(today, dueDate);
    const client = clients.find(c => c.id === t.clienteId);
    const rate = client?.interestRate || 0;
    
    return (t.value * (rate / 100)) * daysOverdue;
  };

  // Form state
  const [formData, setFormData] = useState({
    type: 'in' as 'in' | 'out',
    value: '',
    category: '',
    description: '',
    paymentMethod: 'pix',
    status: 'paid' as 'paid' | 'pending',
    supplierId: '',
    relatedId: '',
    date: formatSafeDate(new Date(), 'yyyy-MM-dd'),
    dueDate: formatSafeDate(new Date(), 'yyyy-MM-dd')
  });

  const summary = useMemo(() => {
    let inc = 0;
    let exp = 0;
    let rec = 0;
    let pay = 0;

    transactions.forEach(t => {
      if (t.status !== 'cancelled') {
        if (t.status === 'paid') {
          if (t.type === 'in') inc += t.value;
          else exp += t.value;
        } else {
          if (t.type === 'in') rec += t.value;
          else pay += t.value;
        }
      }
    });

    return {
      income: inc,
      expense: exp,
      balance: inc - exp,
      receivable: rec,
      payable: pay
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Tab filtering
      if (financeTab === 'receivable' && (t.type !== 'in' || t.status !== 'pending')) return false;
      if (financeTab === 'payable' && (t.type !== 'out' || t.status !== 'pending')) return false;

      const matchesStatus = filters.status === 'all' || t.status === filters.status;
      const matchesType = filters.type === 'all' || t.type === filters.type;
      const matchesOS = filters.relatedId === 'all' || t.relatedId === filters.relatedId;
      const matchesSupplier = filters.supplierId === 'all' || t.fornecedorId === filters.supplierId;
      
      let matchesClient = true;
      if (filters.clientId !== 'all') {
        const os = serviceOrders.find(o => o.id === t.relatedId);
        matchesClient = os?.clienteId === filters.clientId;
      }

      const matchesSearch = t.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                            t.category.toLowerCase().includes(filters.searchTerm.toLowerCase());
      
      // Date filters
      const transactionDate = t.date ? new Date(t.date) : null;
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;

      if (filters.startDate && transactionDate && transactionDate < new Date(filters.startDate)) return false;
      if (filters.endDate && transactionDate && transactionDate > new Date(filters.endDate)) return false;
      if (filters.startDueDate && dueDate && dueDate < new Date(filters.startDueDate)) return false;
      if (filters.endDueDate && dueDate && dueDate > new Date(filters.endDueDate)) return false;

      return matchesStatus && matchesType && matchesOS && matchesSupplier && matchesClient && matchesSearch;
    });
  }, [transactions, financeTab, filters, serviceOrders]);

  const upcomingExpenses = useMemo(() => {
    return transactions.filter(t => {
      if (t.type !== 'out' || t.status !== 'pending') return false;
      const dueDate = new Date(t.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3;
    });
  }, [transactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.value || !formData.category) {
      toast.error('Valor e categoria são obrigatórios.');
      return;
    }

    try {
      await addTransaction({
        ...formData,
        value: parseFloat(formData.value),
        date: formData.date || new Date().toISOString(),
        dueDate: formData.status === 'pending' ? formData.dueDate : undefined,
      });
      
      closeModal();
    } catch (error) {
      console.error(error);
    }
  };

  const markAsPaid = async (id: string) => {
    setConfirmConfig({
      title: 'Confirmar Baixa',
      message: 'Deseja confirmar o recebimento/pagamento desta transação?',
      confirmLabel: 'Confirmar Baixa',
      onConfirm: async () => {
        try {
          await updateTransaction(id, { status: 'paid' });
        } catch (error) {
          console.error(error);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const cancelTransaction = async (id: string) => {
    setConfirmConfig({
      title: 'Cancelar Transação',
      message: 'Tem certeza que deseja cancelar esta transação? Esta ação não pode ser desfeita.',
      confirmLabel: 'Cancelar',
      onConfirm: async () => {
        try {
          await updateTransaction(id, { status: 'cancelled' });
        } catch (error) {
          console.error(error);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const openModal = (type: 'in' | 'out') => {
    setFormData({
      type,
      value: '',
      category: type === 'out' ? 'Despesa' : 'Serviço',
      description: '',
      paymentMethod: type === 'out' ? 'boleto' : 'pix',
      status: 'pending',
      supplierId: '',
      relatedId: '',
      date: formatSafeDate(new Date(), 'yyyy-MM-dd'),
      dueDate: formatSafeDate(new Date(), 'yyyy-MM-dd')
    });
    setIsModalOpen(true);
  };

  const openReceipt = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    if (transaction.relatedId) {
      const os = serviceOrders.find(o => o.id === transaction.relatedId);
      if (os) {
        setRelatedOS(os);
      }
    }
    setIsReceiptModalOpen(true);
  };

  const closeReceipt = () => {
    setIsReceiptModalOpen(false);
    setSelectedTransaction(null);
    setRelatedOS(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      type: 'in',
      value: '',
      category: '',
      description: '',
      paymentMethod: 'pix',
      status: 'paid',
      supplierId: '',
      relatedId: '',
      date: formatSafeDate(new Date(), 'yyyy-MM-dd'),
      dueDate: formatSafeDate(new Date(), 'yyyy-MM-dd')
    });
  };

  const incomeByCategory = transactions
    .filter(t => t.type === 'in' && t.status === 'paid')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.value;
      return acc;
    }, {} as Record<string, number>);

  const expenseByCategory = transactions
    .filter(t => t.type === 'out' && t.status === 'paid')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.value;
      return acc;
    }, {} as Record<string, number>);

  const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  const getChartData = () => {
    if (chartView === 'income') {
      return Object.entries(incomeByCategory).map(([name, value]) => ({ name, value }));
    }
    if (chartView === 'expense') {
      return Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));
    }
    return [
      { name: 'Entradas', value: summary.income, color: '#10b981' },
      { name: 'Saídas', value: summary.expense, color: '#ef4444' },
    ];
  };

  const currentChartData = getChartData();

  return (
    <PageContainer>
      {/* Header Section */}
      <PageHeader 
        title="Financeiro"
        subtitle="Gestão de fluxo de caixa, contas a pagar e receber."
        breadcrumbs={[{ label: 'AutoGestão' }, { label: 'Financeiro' }]}
        actions={canCreate ? (
          <AppButton 
            onClick={() => openModal('in')}
            icon={<Plus size={18} />}
          >
            Novo Lançamento
          </AppButton>
        ) : undefined}
      />

      {/* Sub-navigation Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        {[
          { id: 'transactions', label: 'Transações', icon: List },
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'cost-centers', label: 'Centros de Custo', icon: Tags },
          { id: 'recurring', label: 'Recorrentes', icon: Repeat },
          { id: 'commissions', label: 'Comissões', icon: Users },
          { id: 'closing', label: 'Fechamento', icon: Lock },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
              activeSubTab === tab.id 
                ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'dashboard' && <FinancialDashboard />}
      {activeSubTab === 'cost-centers' && <CostCenterManager />}
      {activeSubTab === 'recurring' && <RecurringTransactions />}
      {activeSubTab === 'commissions' && <CommissionsManager />}
      {activeSubTab === 'closing' && <DailyClosingManager />}

      {activeSubTab === 'transactions' && (
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <AppCard className="p-4 border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entradas</p>
              <h3 className="text-xl font-black text-emerald-600 font-display">{formatCurrency(summary.income)}</h3>
            </AppCard>

            <AppCard className="p-4 border-l-4 border-l-rose-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saídas</p>
              <h3 className="text-xl font-black text-rose-600 font-display">{formatCurrency(summary.expense)}</h3>
            </AppCard>

            <AppCard 
              onClick={() => handleSetFinanceTab('receivable')}
              className={cn(
                "p-4 transition-all cursor-pointer border-l-4",
                financeTab === 'receivable' ? "border-l-amber-500 bg-amber-50/30" : "border-l-amber-200 hover:border-l-amber-500"
              )}
            >
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">A Receber</p>
              <h3 className="text-xl font-black text-amber-600 font-display">{formatCurrency(summary.receivable)}</h3>
            </AppCard>

            <AppCard 
              onClick={() => handleSetFinanceTab('payable')}
              className={cn(
                "p-4 transition-all cursor-pointer border-l-4",
                financeTab === 'payable' ? "border-l-orange-500 bg-orange-50/30" : "border-l-orange-200 hover:border-l-orange-500"
              )}
            >
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">A Pagar</p>
              <h3 className="text-xl font-black text-orange-600 font-display">{formatCurrency(summary.payable)}</h3>
            </AppCard>

            <AppCard 
              className="p-4 bg-slate-900 text-white flex flex-col justify-center cursor-pointer hover:opacity-90 transition-all sm:col-span-2 lg:col-span-1 border-none"
              onClick={() => handleSetFinanceTab('all')}
            >
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo</p>
              <h3 className="text-xl font-black font-display">{formatCurrency(summary.balance)}</h3>
            </AppCard>
          </div>

      {upcomingExpenses.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-amber-900">Atenção: Pagamentos Próximos</h4>
            <p className="text-sm text-amber-700 mb-4">
              Você tem {upcomingExpenses.length} {upcomingExpenses.length === 1 ? 'conta' : 'contas'} a pagar com vencimento próximo ou em atraso.
            </p>
            <div className="flex flex-wrap gap-3">
              {upcomingExpenses.slice(0, 3).map(exp => (
                <div key={exp.id} className="bg-white/50 border border-amber-100 px-3 py-2 rounded-xl text-xs font-medium text-amber-800 flex items-center gap-2">
                  <span className="font-bold">{formatCurrency(exp.value)}</span>
                  <span className="opacity-50">•</span>
                  <span>{exp.description.length > 30 ? exp.description.slice(0, 30) + '...' : exp.description}</span>
                  <span className="opacity-50">•</span>
                  <span className={cn(
                    "font-bold",
                    new Date(exp.date) < new Date() ? "text-red-600" : "text-amber-600"
                  )}>
                    {formatSafeDate(exp.date, 'dd/MM')}
                  </span>
                </div>
              ))}
              {upcomingExpenses.length > 3 && (
                <div className="px-3 py-2 text-xs font-bold text-amber-600">
                  + {upcomingExpenses.length - 3} outros
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Transactions List */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard 
            title={financeTab === 'all' ? 'Fluxo de Caixa' : financeTab === 'receivable' ? 'Contas a Receber' : 'Contas a Pagar'}
            subtitle={financeTab === 'all' ? 'Histórico Geral' : financeTab === 'receivable' ? 'Pendências de Entrada' : 'Pendências de Saída'}
            headerAction={
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => handleSetFinanceTab('all')}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg",
                    financeTab === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Fluxo
                </button>
                <button
                  onClick={() => handleSetFinanceTab('receivable')}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg",
                    financeTab === 'receivable' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Receber
                </button>
                <button
                  onClick={() => handleSetFinanceTab('payable')}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg",
                    financeTab === 'payable' ? "bg-white text-orange-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Pagar
                </button>
              </div>
            }
          >
            {/* Filters Section */}
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1">
                  <AppInput 
                    placeholder="Buscar por descrição ou categoria..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                    icon={<Search size={18} />}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <AppButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const start = new Date(today.getFullYear(), today.getMonth(), 1);
                      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                      setFilters({ 
                        ...filters, 
                        startDate: formatSafeDate(start, 'yyyy-MM-dd'),
                        endDate: formatSafeDate(end, 'yyyy-MM-dd')
                      });
                    }}
                  >
                    Este Mês
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setFilters({ 
                      ...filters, 
                      status: 'all', 
                      type: 'all', 
                      clientId: 'all', 
                      supplierId: 'all', 
                      relatedId: 'all',
                      startDate: '',
                      endDate: '',
                      startDueDate: '',
                      endDueDate: ''
                    })}
                  >
                    Limpar
                  </AppButton>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setFilters({ ...filters, status: 'all' })}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      filters.status === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, status: 'paid' })}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      filters.status === 'paid' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Pagos
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, status: 'pending' })}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      filters.status === 'pending' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Pend.
                  </button>
                </div>

                <select 
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                >
                  <option value="all">Todos Tipos</option>
                  <option value="in">Entradas</option>
                  <option value="out">Saídas</option>
                </select>

                <select 
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={filters.clientId}
                  onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
                >
                  <option value="all">Todos Clientes</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select 
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={filters.relatedId}
                  onChange={(e) => setFilters({ ...filters, relatedId: e.target.value })}
                >
                  <option value="all">Todas OS</option>
                  {serviceOrders
                    .filter(os => transactions.some(t => t.relatedId === os.id))
                    .sort((a, b) => {
                      const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
                      const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
                      return (dateB || 0) - (dateA || 0);
                    })
                    .map(os => (
                      <option key={os.id} value={os.id}>
                        OS #{os.id.slice(-4).toUpperCase()}
                      </option>
                    ))}
                </select>
              </div>

              <DataTable
                columns={[
                  { header: 'Data', accessor: (t) => (
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">
                        {formatSafeDate(t.date, 'dd/MM/yy')}
                      </span>
                      {t.status === 'pending' && t.dueDate && (
                        <span className={cn(
                          "text-[10px] font-bold",
                          new Date(t.dueDate) < new Date() ? "text-rose-500" : "text-slate-400"
                        )}>
                          Venc: {formatSafeDate(t.dueDate, 'dd/MM')}
                        </span>
                      )}
                    </div>
                  )},
                  { header: 'Descrição', accessor: (t) => (
                    <div className="flex flex-col max-w-[200px]">
                      <span className="text-xs font-bold text-slate-900 truncate">{t.description}</span>
                      <span className="text-[10px] font-medium text-slate-400 truncate">
                        {t.clienteId ? clients.find(c => c.id === t.clienteId)?.name : 
                         t.fornecedorId ? suppliers.find(s => s.id === t.fornecedorId)?.name : 
                         t.relatedId ? `OS #${t.relatedId.slice(-4).toUpperCase()}` : 'Geral'}
                      </span>
                    </div>
                  )},
                  { header: 'Categoria', accessor: (t) => (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                      {t.category}
                    </span>
                  )},
                  { header: 'Status', accessor: (t) => (
                    <StatusBadge 
                      status={t.status} 
                      label={t.status === 'paid' ? 'Pago' : t.status === 'pending' ? 'Pendente' : 'Cancelado'}
                    />
                  )},
                  { header: 'Valor', className: 'text-right', accessor: (t) => (
                    <div className="flex flex-col items-end">
                      <span className={cn(
                        "text-xs font-black font-display",
                        t.type === 'in' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {t.type === 'in' ? '+' : '-'} {formatCurrency(t.value)}
                      </span>
                      {calculateInterest(t) > 0 && (
                        <span className="text-[9px] font-bold text-rose-500">
                          + Juros: {formatCurrency(calculateInterest(t))}
                        </span>
                      )}
                    </div>
                  )},
                  { header: 'Ações', className: 'text-right', accessor: (t) => (
                    <div className="flex items-center justify-end gap-1">
                      {t.status === 'pending' && canEdit && (
                        <AppButton
                          variant="secondary"
                          size="sm"
                          onClick={() => markAsPaid(t.id)}
                          title="Confirmar Baixa"
                          className="h-8 w-8 p-0"
                        >
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        </AppButton>
                      )}
                      <AppButton
                        variant="secondary"
                        size="sm"
                        onClick={() => openReceipt(t)}
                        title="Ver Comprovante"
                        className="h-8 w-8 p-0"
                      >
                        <Printer size={14} />
                      </AppButton>
                      {t.status !== 'cancelled' && canDelete && (
                        <AppButton
                          variant="secondary"
                          size="sm"
                          onClick={() => cancelTransaction(t.id)}
                          title="Cancelar"
                          className="h-8 w-8 p-0"
                        >
                          <Ban size={14} className="text-rose-500" />
                        </AppButton>
                      )}
                    </div>
                  )}
                ]}
                data={filteredTransactions}
                isLoading={financeLoading}
                emptyMessage="Nenhuma transação encontrada."
              />
            </div>
          </SectionCard>
        </div>

        {/* Sidebar: Charts & Upcoming */}
        <div className="space-y-6">
          <SectionCard 
            title="Distribuição" 
            subtitle="Por categoria"
            headerAction={
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setChartView('general')}
                  className={cn(
                    "px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all rounded-md",
                    chartView === 'general' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Geral
                </button>
                <button
                  onClick={() => setChartView('income')}
                  className={cn(
                    "px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all rounded-md",
                    chartView === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  In
                </button>
                <button
                  onClick={() => setChartView('expense')}
                  className={cn(
                    "px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all rounded-md",
                    chartView === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Out
                </button>
              </div>
            }
          >
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={currentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {currentChartData.map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{payload[0].name}</p>
                            <p className="text-xs font-black">{formatCurrency(Number(payload[0].value))}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {currentChartData.slice(0, 4).map((entry: any, index: number) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: entry.color || CHART_COLORS[index % CHART_COLORS.length] }} 
                    />
                    <span className="text-[10px] font-bold text-slate-600 truncate max-w-[100px]">{entry.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-900">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Próximos Vencimentos" subtitle="Próximos 3 dias">
            <div className="space-y-3">
              {upcomingExpenses.length > 0 ? (
                upcomingExpenses.slice(0, 5).map(exp => (
                  <div key={exp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {formatSafeDate(exp.date, 'dd/MM/yy')}
                      </span>
                      <StatusBadge status="pending" label="Pendente" />
                    </div>
                    <p className="text-xs font-bold text-slate-900 truncate mb-1">{exp.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-600">{formatCurrency(exp.value)}</span>
                      <AppButton 
                        variant="secondary" 
                        size="sm" 
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => markAsPaid(exp.id)}
                      >
                        <CheckCircle2 size={12} />
                      </AppButton>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-20" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tudo em dia!</p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )}

      {/* Modals */}
      <AppDialog
        isOpen={isModalOpen}
        onClose={closeModal}
        title={formData.type === 'in' ? 'Nova Entrada' : 'Nova Saída'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AppInput
              label="Valor"
              type="number"
              step="0.01"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="0,00"
              required
              icon={<DollarSign size={18} />}
            />
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
              <select
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">Selecione...</option>
                {formData.type === 'in' ? (
                  <>
                    <option value="Serviço">Serviço</option>
                    <option value="Venda">Venda</option>
                    <option value="Outros">Outros</option>
                  </>
                ) : (
                  <>
                    <option value="Aluguel">Aluguel</option>
                    <option value="Energia">Energia</option>
                    <option value="Internet">Internet</option>
                    <option value="Salários">Salários</option>
                    <option value="Impostos">Impostos</option>
                    <option value="Fornecedores">Fornecedores</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Outros">Outros</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <AppInput
            label="Descrição"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ex: Pagamento de fornecedor X"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AppInput
              label="Data do Lançamento"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'paid' })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    formData.status === 'paid' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Pago
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'pending' })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    formData.status === 'pending' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Pendente
                </button>
              </div>
            </div>
          </div>

          {formData.status === 'pending' && (
            <AppInput
              label="Data de Vencimento"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          )}

          <div className="flex justify-end gap-3 pt-4">
            <AppButton variant="secondary" onClick={closeModal} type="button">
              Cancelar
            </AppButton>
            <AppButton type="submit">
              Salvar Lançamento
            </AppButton>
          </div>
        </form>
      </AppDialog>

      <AppDialog
        isOpen={isReceiptModalOpen}
        onClose={closeReceipt}
        title="Comprovante de Transação"
      >
        {selectedTransaction && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-4">
              <div className={cn(
                "w-16 h-16 rounded-full mx-auto flex items-center justify-center",
                selectedTransaction.type === 'in' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              )}>
                {selectedTransaction.type === 'in' ? <ArrowDownCircle size={32} /> : <ArrowUpRight size={32} />}
              </div>
              <div>
                <h4 className="text-2xl font-black text-slate-900 font-display">
                  {formatCurrency(selectedTransaction.value)}
                </h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {selectedTransaction.type === 'in' ? 'Entrada Confirmada' : 'Saída Confirmada'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data</p>
                  <p className="text-sm font-black text-slate-900">{formatSafeDate(selectedTransaction.date, 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Categoria</p>
                  <p className="text-sm font-bold text-slate-900">{selectedTransaction.category}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Descrição</p>
                <p className="text-sm font-bold text-slate-900">{selectedTransaction.description}</p>
              </div>

              {relatedOS && (
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <LayoutDashboard size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Ordem de Serviço</p>
                      <p className="text-sm font-bold text-slate-900">#{relatedOS.id.slice(-6).toUpperCase()}</p>
                    </div>
                  </div>
                  <AppButton 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setActiveTab?.('service-orders', relatedOS.id)}
                  >
                    Ver OS
                  </AppButton>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <AppButton variant="secondary" onClick={closeReceipt}>
                Fechar
              </AppButton>
              <AppButton onClick={() => window.print()} icon={<Printer size={18} />}>
                Imprimir
              </AppButton>
            </div>
          </div>
        )}
      </AppDialog>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
      />
    </PageContainer>
  );
};

export default Finance;
