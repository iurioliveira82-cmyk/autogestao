import React, { useState, useEffect } from 'react';
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
  List
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Transaction, Supplier, OperationType, ServiceOrder, Client } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../auth/Auth';
import { formatCurrency, cn, handleFirestoreError } from '../../utils';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    income: 0,
    expense: 0,
    balance: 0,
    receivable: 0,
    payable: 0
  });

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
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [relatedOS, setRelatedOS] = useState<any>(null);
  const [chartView, setChartView] = useState<'general' | 'income' | 'expense'>('general');
  const [financeTab, setFinanceTab] = useState<'all' | 'receivable' | 'payable'>(() => {
    const saved = localStorage.getItem('financeTab');
    if (saved === 'receivable' || saved === 'payable' || saved === 'all') return saved;
    return 'all';
  });
  const [activeSubTab, setActiveSubTab] = useState<'transactions' | 'dashboard' | 'cost-centers' | 'recurring' | 'commissions' | 'closing'>('transactions');

  const handleSetFinanceTab = (tab: 'all' | 'receivable' | 'payable') => {
    setFinanceTab(tab);
    localStorage.setItem('financeTab', tab);
  };
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'success'
  });
  const { canCreate, canEdit, canDelete } = usePermissions('finance');

  const calculateInterest = (transaction: Transaction) => {
    if (transaction.type !== 'in' || transaction.status !== 'pending' || !transaction.dueDate) return 0;
    
    const dueDate = new Date(transaction.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate >= today) return 0;
    
    const diffDays = Math.max(0, differenceInDays(today, dueDate));
    if (diffDays <= 0) return 0;
    
    // Find client to get interest rate
    const client = clients.find(c => c.id === transaction.clienteId);
    const rate = client?.interestRate || 0; // monthly rate
    
    // Simple interest calculation: (value * rate/100) * (days / 30)
    const interest = (transaction.value * (rate / 100)) * (diffDays / 30);
    return interest;
  };

  useEffect(() => {
    if (!profile?.empresaId) return;
    
    if (profile.role !== 'admin') {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'transacoes_financeiras'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      let inc = 0;
      let exp = 0;
      let rec = 0;
      let pay = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data() as Transaction;
        const transaction = { id: doc.id, ...data };
        list.push(transaction);
        
        if (data.status !== 'cancelled') {
          if (data.status === 'paid') {
            if (data.type === 'in') inc += data.value;
            else exp += data.value;
          } else {
            if (data.type === 'in') {
              const interest = calculateInterest(transaction);
              rec += data.value + interest;
            }
            else pay += data.value;
          }
        }
      });
      
      setTransactions(list);
      setSummary({ 
        income: inc, 
        expense: exp, 
        balance: inc - exp,
        receivable: rec,
        payable: pay
      });
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transacoes_financeiras');
      setLoading(false);
    });

    const unsubscribeSuppliers = onSnapshot(
      query(collection(db, 'fornecedores'), where('empresaId', '==', profile.empresaId)), 
      (snapshot) => {
        const list: Supplier[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Supplier));
        setSuppliers(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'fornecedores')
    );

    const unsubscribeOS = onSnapshot(
      query(collection(db, 'ordens_servico'), where('empresaId', '==', profile.empresaId)), 
      (snapshot) => {
        const list: ServiceOrder[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as ServiceOrder));
        setServiceOrders(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'ordens_servico')
    );

    const unsubscribeClients = onSnapshot(
      query(collection(db, 'clientes'), where('empresaId', '==', profile.empresaId)), 
      (snapshot) => {
        const list: Client[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Client));
        setClients(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'clientes')
    );

    return () => {
      unsubscribe();
      unsubscribeSuppliers();
      unsubscribeOS();
      unsubscribeClients();
    };
  }, [profile]);

  const filteredTransactions = transactions.filter(t => {
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

  const upcomingExpenses = transactions.filter(t => {
    if (t.type !== 'out' || t.status !== 'pending') return false;
    const dueDate = new Date(t.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.value || !formData.category) {
      toast.error('Valor e categoria são obrigatórios.');
      return;
    }

    try {
      await addDoc(collection(db, 'transacoes_financeiras'), {
        ...formData,
        empresaId: profile.empresaId,
        value: parseFloat(formData.value),
        date: formData.date || new Date().toISOString(),
        dueDate: formData.status === 'pending' ? formData.dueDate : undefined,
        status: formData.status,
        supplierId: formData.type === 'out' ? formData.supplierId : undefined,
        relatedId: formData.relatedId || undefined,
        createdAt: serverTimestamp()
      });
      
      toast.success('Transação registrada com sucesso!');
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar transação.');
    }
  };

  const toggleStatus = async (transaction: Transaction) => {
    try {
      const newStatus = transaction.status === 'paid' ? 'pending' : 'paid';
      await updateDoc(doc(db, 'transacoes_financeiras', transaction.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Status atualizado para ${newStatus === 'paid' ? 'Pago' : 'Pendente'}`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar status.');
    }
  };

  const markAsPaid = async (id: string) => {
    setConfirmAction({
      isOpen: true,
      title: 'Confirmar Baixa',
      message: 'Deseja confirmar o recebimento/pagamento desta transação?',
      type: 'success',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'transacoes_financeiras', id), {
            status: 'paid',
            updatedAt: serverTimestamp()
          });
          toast.success('Pagamento baixado com sucesso!');
        } catch (error) {
          console.error(error);
          toast.error('Erro ao baixar pagamento.');
        } finally {
          setConfirmAction(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const cancelTransaction = async (id: string) => {
    setConfirmAction({
      isOpen: true,
      title: 'Cancelar Transação',
      message: 'Tem certeza que deseja cancelar esta transação? Esta ação não pode ser desfeita.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'transacoes_financeiras', id), {
            status: 'cancelled',
            updatedAt: serverTimestamp()
          });
          toast.success('Transação cancelada com sucesso!');
        } catch (error) {
          console.error(error);
          toast.error('Erro ao cancelar transação.');
        } finally {
          setConfirmAction(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
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
      date: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(new Date(), 'yyyy-MM-dd')
    });
    setIsModalOpen(true);
  };

  const openReceipt = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    if (transaction.relatedId) {
      try {
        const osDoc = await getDoc(doc(db, 'ordens_servico', transaction.relatedId));
        if (osDoc.exists()) {
          setRelatedOS({ id: osDoc.id, ...osDoc.data() });
        }
      } catch (error) {
        console.error('Erro ao buscar OS:', error);
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
      date: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(new Date(), 'yyyy-MM-dd')
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
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Módulo Financeiro</h2>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.3em] mt-1">Gestão de Fluxo de Caixa e Rentabilidade</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => openModal('in')}
            className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-xl shadow-zinc-200"
          >
            <Plus size={20} />
            Novo Lançamento
          </button>
        </div>
      </div>

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
              "flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap border",
              activeSubTab === tab.id 
                ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200" 
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
            )}
          >
            <tab.icon size={18} />
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
        <>
          {/* Financial Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Entradas</p>
          <h3 className="text-lg font-black text-green-600">{formatCurrency(summary.income)}</h3>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Saídas</p>
          <h3 className="text-lg font-black text-red-600">{formatCurrency(summary.expense)}</h3>
        </div>

        <div 
          onClick={() => handleSetFinanceTab('receivable')}
          className={cn(
            "bg-white p-4 rounded-2xl border shadow-sm transition-all cursor-pointer",
            financeTab === 'receivable' ? "border-amber-500 ring-1 ring-amber-500" : "border-zinc-200 hover:border-amber-200"
          )}
        >
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">A Receber</p>
          <h3 className="text-lg font-black text-amber-600">{formatCurrency(summary.receivable)}</h3>
        </div>

        <div 
          onClick={() => handleSetFinanceTab('payable')}
          className={cn(
            "bg-white p-4 rounded-2xl border shadow-sm transition-all cursor-pointer",
            financeTab === 'payable' ? "border-orange-500 ring-1 ring-orange-500" : "border-zinc-200 hover:border-orange-200"
          )}
        >
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">A Pagar</p>
          <h3 className="text-lg font-black text-orange-600">{formatCurrency(summary.payable)}</h3>
        </div>

        <div 
          className="bg-accent p-4 rounded-2xl shadow-sm text-accent-foreground flex flex-col justify-center cursor-pointer hover:opacity-90 transition-all sm:col-span-2 lg:col-span-1"
          onClick={() => handleSetFinanceTab('all')}
        >
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Saldo</p>
          <h3 className="text-lg font-black">{formatCurrency(summary.balance)}</h3>
        </div>
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
                    {format(new Date(exp.date), 'dd/MM')}
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
        <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap p-2 bg-zinc-50/50 border-b border-zinc-100 gap-2">
            <button
              onClick={() => handleSetFinanceTab('all')}
              className={cn(
                "flex-1 py-3 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-2xl",
                financeTab === 'all' 
                  ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" 
                  : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              )}
            >
              Fluxo
            </button>
            <button
              onClick={() => handleSetFinanceTab('receivable')}
              className={cn(
                "flex-1 py-3 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-2xl",
                financeTab === 'receivable' 
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-100" 
                  : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              )}
            >
              Receber
            </button>
            <button
              onClick={() => handleSetFinanceTab('payable')}
              className={cn(
                "flex-1 py-3 px-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-2xl",
                financeTab === 'payable' 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-100" 
                  : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              )}
            >
              Pagar
            </button>
          </div>

          <div className="p-4 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-zinc-900">
                  {financeTab === 'all' ? 'Fluxo de Caixa' : 
                   financeTab === 'receivable' ? 'Contas a Receber' : 'Contas a Pagar'}
                </h3>
                <p className="text-[10px] sm:text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">
                  {financeTab === 'all' ? 'Histórico Geral' : 
                   financeTab === 'receivable' ? 'Pendências de Entrada' : 'Pendências de Saída'}
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {canCreate && (
                  <>
                    <button 
                      onClick={() => openModal('in')}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 text-white px-5 py-3 rounded-2xl font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                    >
                      <Plus size={18} />
                      Receber
                    </button>
                    <button 
                      onClick={() => openModal('out')}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-3 rounded-2xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                    >
                      <Plus size={18} />
                      Pagar
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Filters Section - Only for Fluxo de Caixa as requested */}
            {financeTab === 'all' && (
              <div className="space-y-6 pt-6 border-t border-zinc-100">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar por descrição ou categoria..."
                      className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      value={filters.searchTerm}
                      onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                    <button
                      onClick={() => {
                        const today = new Date();
                        const start = new Date(today.getFullYear(), today.getMonth(), 1);
                        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        setFilters({ 
                          ...filters, 
                          startDate: format(start, 'yyyy-MM-dd'),
                          endDate: format(end, 'yyyy-MM-dd')
                        });
                      }}
                      className="whitespace-nowrap px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                    >
                      Este Mês
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                        const end = new Date(today.getFullYear(), today.getMonth(), 0);
                        setFilters({ 
                          ...filters, 
                          startDate: format(start, 'yyyy-MM-dd'),
                          endDate: format(end, 'yyyy-MM-dd')
                        });
                      }}
                      className="whitespace-nowrap px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                    >
                      Mês Passado
                    </button>
                    <button
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
                      className="whitespace-nowrap px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setFilters({ ...filters, status: 'all' })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        filters.status === 'all' ? "bg-accent text-accent-foreground shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                      )}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setFilters({ ...filters, status: 'paid' })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        filters.status === 'paid' ? "bg-white text-green-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                      )}
                    >
                      Pagos
                    </button>
                    <button
                      onClick={() => setFilters({ ...filters, status: 'pending' })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        filters.status === 'pending' ? "bg-white text-amber-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                      )}
                    >
                      Pend.
                    </button>
                  </div>

                  <select 
                    className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                  >
                    <option value="all">Todos Tipos</option>
                    <option value="in">Entradas</option>
                    <option value="out">Saídas</option>
                  </select>

                  <select 
                    className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    value={filters.clientId}
                    onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
                  >
                    <option value="all">Todos Clientes</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select 
                    className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    value={filters.relatedId}
                    onChange={(e) => setFilters({ ...filters, relatedId: e.target.value })}
                  >
                    <option value="all">Todas OS</option>
                    {serviceOrders
                      .filter(os => transactions.some(t => t.relatedId === os.id))
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(os => (
                        <option key={os.id} value={os.id}>
                          OS #{os.id.slice(-4).toUpperCase()}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Lançamento (Início)</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      value={filters.startDate}
                      onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Lançamento (Fim)</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      value={filters.endDate}
                      onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Vencimento (Início)</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      value={filters.startDueDate}
                      onChange={(e) => setFilters({ ...filters, startDueDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Vencimento (Fim)</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      value={filters.endDueDate}
                      onChange={(e) => setFilters({ ...filters, endDueDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Filtered Summary */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-100">
                  <div className="bg-green-50/50 p-4 rounded-3xl border border-green-100">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Entradas</p>
                    <p className="text-xl font-black text-green-700">
                      {formatCurrency(filteredTransactions.filter(t => t.type === 'in' && t.status !== 'cancelled').reduce((acc, t) => acc + t.value, 0))}
                    </p>
                  </div>
                  <div className="bg-red-50/50 p-4 rounded-3xl border border-red-100">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Saídas</p>
                    <p className="text-xl font-black text-red-700">
                      {formatCurrency(filteredTransactions.filter(t => t.type === 'out' && t.status !== 'cancelled').reduce((acc, t) => acc + t.value, 0))}
                    </p>
                  </div>
                  <div className="bg-zinc-100/50 p-4 rounded-3xl border border-zinc-200">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Saldo</p>
                    <p className="text-xl font-black text-accent">
                      {formatCurrency(
                        filteredTransactions.filter(t => t.status !== 'cancelled').reduce((acc, t) => t.type === 'in' ? acc + t.value : acc - t.value, 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                  <th className="px-8 py-4">Datas</th>
                  <th className="px-8 py-4">
                    {financeTab === 'receivable' ? 'Cliente / OS' : 
                     financeTab === 'payable' ? 'Fornecedor / Descrição' : 'Descrição'}
                  </th>
                  <th className="px-8 py-4">Categoria</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Valor</th>
                  <th className="px-8 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td colSpan={6} className="px-8 py-10 text-center text-zinc-400 italic">Carregando transações...</td>
                    </motion.tr>
                  ) : filteredTransactions.length > 0 ? filteredTransactions.map((t) => {
                    const isUpcoming = upcomingExpenses.some(ue => ue.id === t.id);
                    const os = serviceOrders.find(o => o.id === t.relatedId);
                    const client = t.clienteId ? clients.find(c => c.id === t.clienteId) : (os ? clients.find(c => c.id === os.clienteId) : null);
                    const supplier = suppliers.find(s => s.id === t.fornecedorId);
                    const interest = calculateInterest(t);
                    const isOverdue = t.status === 'pending' && t.dueDate && new Date(t.dueDate) < new Date();

                    return (
                      <motion.tr 
                        key={t.id} 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "hover:bg-zinc-50 transition-colors",
                          isUpcoming && "bg-amber-50/30",
                          isOverdue && "bg-red-50/20"
                        )}
                      >
                        <td className="px-8 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-zinc-400" />
                            <span className="text-xs font-bold text-accent">{format(new Date(t.date), 'dd/MM/yy')}</span>
                            <span className="text-[8px] text-zinc-400 uppercase font-black">Lanç.</span>
                          </div>
                          {t.dueDate && t.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={12} className={cn(isUpcoming ? "text-red-500" : "text-amber-500")} />
                              <span className={cn("text-xs font-bold", isUpcoming ? "text-red-600" : "text-amber-600")}>
                                {format(new Date(t.dueDate), 'dd/MM/yy')}
                              </span>
                              <span className="text-[8px] text-zinc-400 uppercase font-black">Venc.</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          {financeTab === 'receivable' ? (
                            <>
                              <span className="text-sm font-bold text-accent">{client?.name || 'Cliente não identificado'}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                  OS #{t.relatedId?.slice(-4).toUpperCase()} - {t.description}
                                </span>
                                {t.relatedId && setActiveTab && (
                                  <button 
                                    onClick={() => setActiveTab('os', t.relatedId)}
                                    className="p-1 text-accent hover:bg-accent/10 rounded-md transition-all"
                                    title="Ver OS"
                                  >
                                    <ArrowUpRight size={12} />
                                  </button>
                                )}
                              </div>
                            </>
                          ) : financeTab === 'payable' ? (
                            <>
                              <span className="text-sm font-bold text-accent">{supplier?.name || 'Fornecedor não identificado'}</span>
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                {t.description}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-bold text-accent">{t.description}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">{t.paymentMethod}</span>
                                {t.fornecedorId && (
                                  <>
                                    <span className="text-zinc-300">|</span>
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                      {supplier?.name || 'Fornecedor'}
                                    </span>
                                  </>
                                )}
                                {t.relatedId && (
                                  <>
                                    <span className="text-zinc-300">|</span>
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                      OS #{t.relatedId.slice(-4).toUpperCase()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-zinc-100 rounded-lg text-xs font-bold text-zinc-600">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                          t.status === 'paid' 
                            ? "bg-green-100 text-green-700" 
                            : t.status === 'cancelled'
                            ? "bg-zinc-100 text-zinc-400"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          {t.status === 'paid' ? 'Pago' : t.status === 'cancelled' ? 'Cancelado' : 'Aguardando'}
                        </span>
                        {isUpcoming && t.status === 'pending' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[8px] font-black uppercase tracking-tighter animate-pulse">
                            Urgente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn(
                      "px-8 py-5 text-right font-black",
                      t.status === 'cancelled' ? "text-zinc-300 line-through" :
                      t.type === 'in' ? "text-green-600" : "text-red-600"
                    )}>
                      <div className="flex flex-col items-end">
                        <span>{t.type === 'in' ? '+' : '-'} {formatCurrency(t.value + interest)}</span>
                        {interest > 0 && (
                          <span className="text-[9px] text-red-500 font-bold uppercase tracking-tighter">
                            + {formatCurrency(interest)} Juros
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {t.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => markAsPaid(t.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-green-100 transition-all border border-green-100"
                              title="Dar Baixa (Pagar/Receber)"
                            >
                              <CheckCircle2 size={12} />
                              Baixar
                            </button>
                            <button 
                              onClick={() => cancelTransaction(t.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-all border border-red-100"
                              title="Cancelar Transação"
                            >
                              <Ban size={12} />
                              Cancelar
                            </button>
                          </>
                        )}
                        {t.status === 'paid' && t.type === 'in' && (
                          <button 
                            onClick={() => openReceipt(t)}
                            className="p-2 text-zinc-400 hover:text-accent hover:bg-zinc-100 rounded-xl transition-all"
                            title="Gerar Comprovante"
                          >
                            <Download size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              }) : (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <td colSpan={6} className="px-8 py-10 text-center text-zinc-400 italic">Nenhuma transação registrada.</td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
            </table>
          </div>

          {/* Transaction List - Mobile Cards */}
          <div className="sm:hidden space-y-4">
            {loading ? (
              <div className="py-10 text-center text-zinc-400 italic">Carregando transações...</div>
            ) : filteredTransactions.length > 0 ? filteredTransactions.map((t) => {
              const isUpcoming = upcomingExpenses.some(ue => ue.id === t.id);
              const os = serviceOrders.find(o => o.id === t.relatedId);
              const client = t.clienteId ? clients.find(c => c.id === t.clienteId) : (os ? clients.find(c => c.id === os.clienteId) : null);
              const supplier = suppliers.find(s => s.id === t.fornecedorId);
              const interest = calculateInterest(t);
              const isOverdue = t.status === 'pending' && t.dueDate && new Date(t.dueDate) < new Date();

              return (
                <div 
                  key={t.id}
                  className={cn(
                    "p-4 rounded-2xl border border-zinc-100 space-y-4",
                    isUpcoming && "bg-amber-50/30 border-amber-100",
                    isOverdue && "bg-red-50/30 border-red-100"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-zinc-400" />
                        <span className="text-xs font-bold text-accent">{format(new Date(t.date), 'dd/MM/yy')}</span>
                      </div>
                      <h4 className="text-sm font-bold text-accent">
                        {financeTab === 'receivable' ? (client?.name || 'Cliente') : 
                         financeTab === 'payable' ? (supplier?.name || 'Fornecedor') : t.description}
                      </h4>
                      {financeTab !== 'all' && (
                        <p className="text-[10px] text-zinc-500 font-medium">{t.description}</p>
                      )}
                    </div>
                    <div className={cn(
                      "text-sm font-black text-right",
                      t.status === 'cancelled' ? "text-zinc-300 line-through" :
                      t.type === 'in' ? "text-green-600" : "text-red-600"
                    )}>
                      <div>{t.type === 'in' ? '+' : '-'} {formatCurrency(t.value + interest)}</div>
                      {interest > 0 && (
                        <div className="text-[8px] text-red-500 font-bold uppercase tracking-tighter">
                          + {formatCurrency(interest)} Juros
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-50">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                        t.status === 'paid' ? "bg-green-100 text-green-700" : 
                        t.status === 'cancelled' ? "bg-zinc-100 text-zinc-400" : "bg-amber-100 text-amber-700"
                      )}>
                        {t.status === 'paid' ? 'Pago' : t.status === 'cancelled' ? 'Cancelado' : 'Aguardando'}
                      </span>
                      <span className="px-2 py-0.5 bg-zinc-100 rounded text-[8px] font-bold text-zinc-500 uppercase">
                        {t.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => markAsPaid(t.id)}
                            className="p-2 bg-green-50 text-green-700 rounded-lg"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button 
                            onClick={() => cancelTransaction(t.id)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg"
                          >
                            <Ban size={14} />
                          </button>
                        </>
                      )}
                      {t.status === 'paid' && t.type === 'in' && (
                        <button 
                          onClick={() => openReceipt(t)}
                          className="p-2 text-zinc-400 hover:text-accent"
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="py-10 text-center text-zinc-400 italic">Nenhuma transação registrada.</div>
            )}
          </div>

        </div>
      </div>

        {/* Distribution Chart */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <h3 className="text-lg sm:text-xl font-bold text-accent">Distribuição</h3>
            <div className="flex bg-zinc-100 p-1 rounded-lg w-full sm:w-auto">
              <button 
                onClick={() => setChartView('general')}
                className={cn("flex-1 sm:flex-none px-3 py-1 text-[10px] font-bold rounded-md transition-all", chartView === 'general' ? "bg-accent text-accent-foreground shadow-sm" : "text-zinc-500")}
              >
                Geral
              </button>
              <button 
                onClick={() => setChartView('income')}
                className={cn("flex-1 sm:flex-none px-3 py-1 text-[10px] font-bold rounded-md transition-all", chartView === 'income' ? "bg-white text-green-600 shadow-sm" : "text-zinc-500")}
              >
                Entradas
              </button>
              <button 
                onClick={() => setChartView('expense')}
                className={cn("flex-1 sm:flex-none px-3 py-1 text-[10px] font-bold rounded-md transition-all", chartView === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-zinc-500")}
              >
                Saídas
              </button>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 mb-8">
            {chartView === 'general' ? 'Proporção entre entradas e saídas' : 
             chartView === 'income' ? 'Entradas por categoria' : 'Saídas por categoria'}
          </p>
          
          <div className="h-[200px] sm:h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={currentChartData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {currentChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 space-y-4">
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Lucratividade</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-accent">
                  {summary.income > 0 ? Math.round((summary.balance / summary.income) * 100) : 0}%
                </span>
                <div className="w-24 h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent" 
                    style={{ width: `${summary.income > 0 ? Math.min(100, Math.max(0, (summary.balance / summary.income) * 100)) : 0}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-accent">
                {formData.type === 'in' ? 'Lançar Recebimento' : 'Lançar Pagamento'}
              </h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-accent rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="flex p-1 bg-zinc-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'in' })}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                    formData.type === 'in' ? "bg-white text-green-600 shadow-sm" : "text-zinc-500"
                  )}
                >
                  A Receber (Entrada)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'out' })}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                    formData.type === 'out' ? "bg-white text-red-600 shadow-sm" : "text-zinc-500"
                  )}
                >
                  A Pagar (Saída)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Data Lançamento</label>
                  <input 
                    type="date" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Data Vencimento</label>
                  <input 
                    type="date" 
                    required={formData.status === 'pending'}
                    disabled={formData.status === 'paid'}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all disabled:opacity-50"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Valor (R$)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all font-bold"
                    placeholder="0.00"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="paid">Pago</option>
                    <option value="pending">Aguardando Pagamento</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Pagamento</label>
                <select 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  <option value="pix">Pix</option>
                  <option value="card">Cartão</option>
                  <option value="cash">Dinheiro</option>
                  <option value="transfer">Transferência</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>

              {formData.type === 'out' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Fornecedor</label>
                    <select 
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    >
                      <option value="">Opcional...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">OS Relacionada</label>
                    <select 
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      value={formData.relatedId}
                      onChange={(e) => setFormData({ ...formData, relatedId: e.target.value })}
                    >
                      <option value="">Opcional...</option>
                      {serviceOrders
                        .filter(os => os.status !== 'cancelada')
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(os => {
                          const client = clients.find(c => c.id === os.clienteId);
                          return (
                            <option key={os.id} value={os.id}>
                              OS #{os.id.slice(-4).toUpperCase()} - {client?.name || 'Cliente'}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Categoria</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  placeholder="Ex: Peças, Aluguel, Salários..."
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Descrição</label>
                <textarea 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all min-h-[80px]"
                  placeholder="Detalhes da transação..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="pt-4 flex items-center gap-4">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-4 border border-zinc-200 text-zinc-600 font-bold rounded-2xl hover:bg-zinc-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-accent text-accent-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction.isOpen && (
          <div className="fixed inset-0 bg-zinc-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6",
                  confirmAction.type === 'danger' ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                )}>
                  {confirmAction.type === 'danger' ? <Ban size={32} /> : <CheckCircle2 size={32} />}
                </div>
                <h3 className="text-xl font-bold text-accent mb-2">{confirmAction.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{confirmAction.message}</p>
              </div>
              <div className="p-8 bg-zinc-50 flex items-center gap-3">
                <button 
                  onClick={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-6 py-3 border border-zinc-200 text-zinc-600 font-bold rounded-xl hover:bg-white transition-all"
                >
                  Não, Voltar
                </button>
                <button 
                  onClick={confirmAction.onConfirm}
                  className={cn(
                    "flex-1 px-6 py-3 text-white font-bold rounded-xl transition-all shadow-lg",
                    confirmAction.type === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-green-600 hover:bg-green-700 shadow-green-200"
                  )}
                >
                  Sim, Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      {isReceiptModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-accent text-accent-foreground">
              <div>
                <h3 className="text-xl font-bold">Comprovante de Serviço</h3>
                <p className="text-xs text-accent-foreground/60 uppercase tracking-widest mt-1">Recibo de Pagamento</p>
              </div>
              <button onClick={closeReceipt} className="p-2 text-accent-foreground/60 hover:text-accent-foreground rounded-lg transition-all">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Header Info */}
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-2xl font-black text-accent">AutoGestão SaaS</h4>
                  <p className="text-sm text-zinc-500">Soluções Automotivas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-accent">Data: {format(new Date(selectedTransaction.date), 'dd/MM/yyyy HH:mm')}</p>
                  <p className="text-xs text-zinc-500">Nº {selectedTransaction.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <div className="h-px bg-zinc-100" />

              {/* Transaction Details */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Detalhes do Pagamento</h5>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Descrição</p>
                    <p className="text-sm font-bold text-accent">{selectedTransaction.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Método de Pagamento</p>
                    <p className="text-sm font-bold text-accent uppercase">{selectedTransaction.paymentMethod}</p>
                  </div>
                </div>
              </div>

              {/* OS Services if applicable */}
              {relatedOS && (
                <div className="space-y-4">
                  <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Serviços Realizados</h5>
                  <div className="bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-100">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-zinc-100/50 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                          <th className="px-4 py-3">Serviço</th>
                          <th className="px-4 py-3 text-right">Preço</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {relatedOS.servicos?.map((s: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-medium text-accent">{s.name}</td>
                            <td className="px-4 py-3 text-right font-bold text-accent">{formatCurrency(s.price)}</td>
                          </tr>
                        ))}
                        {relatedOS.discount > 0 && (
                          <tr className="bg-zinc-100/30">
                            <td className="px-4 py-3 font-medium text-red-600">Desconto</td>
                            <td className="px-4 py-3 text-right font-bold text-red-600">-{formatCurrency(relatedOS.discount)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="h-px bg-zinc-100" />

              {/* Total */}
              <div className="flex justify-between items-center bg-accent text-accent-foreground p-6 rounded-2xl">
                <span className="text-sm font-bold uppercase tracking-widest">Valor Total Pago</span>
                <span className="text-3xl font-black">{formatCurrency(selectedTransaction.value)}</span>
              </div>

              <div className="text-center pt-4">
                <p className="text-xs text-zinc-400 italic">Obrigado pela preferência!</p>
              </div>
            </div>

            <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex gap-4">
              <button 
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20"
              >
                <Printer size={20} />
                Imprimir
              </button>
              <button 
                onClick={closeReceipt}
                className="flex-1 px-6 py-4 border border-zinc-200 text-zinc-600 font-bold rounded-2xl hover:bg-zinc-100 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
