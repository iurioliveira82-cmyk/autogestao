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
  Printer
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Transaction, Supplier, OperationType } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from './Auth';
import { formatCurrency, cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const Finance: React.FC = () => {
  const { profile } = useAuth();
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
    status: 'all' as 'all' | 'paid' | 'pending',
    type: 'all' as 'all' | 'in' | 'out',
    searchTerm: ''
  });

  // Form state
  const [formData, setFormData] = useState({
    type: 'in' as 'in' | 'out',
    value: '',
    category: '',
    description: '',
    paymentMethod: 'pix',
    status: 'paid' as 'paid' | 'pending',
    supplierId: ''
  });

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [relatedOS, setRelatedOS] = useState<any>(null);
  const { canCreate, canEdit, canDelete } = usePermissions('finance');

  useEffect(() => {
    if (!profile) return;
    
    if (profile.role !== 'admin') {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      let inc = 0;
      let exp = 0;
      let rec = 0;
      let pay = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data() as Transaction;
        list.push({ id: doc.id, ...data });
        
        if (data.status === 'paid') {
          if (data.type === 'in') inc += data.value;
          else exp += data.value;
        } else {
          if (data.type === 'in') rec += data.value;
          else pay += data.value;
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
      handleFirestoreError(error, OperationType.GET, 'transactions');
      setLoading(false);
    });

    const unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const list: Supplier[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'suppliers'));

    return () => {
      unsubscribe();
      unsubscribeSuppliers();
    };
  }, [profile]);

  const filteredTransactions = transactions.filter(t => {
    const matchesStatus = filters.status === 'all' || t.status === filters.status;
    const matchesType = filters.type === 'all' || t.type === filters.type;
    const matchesSearch = t.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                          t.category.toLowerCase().includes(filters.searchTerm.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.value || !formData.category) {
      toast.error('Valor e categoria são obrigatórios.');
      return;
    }

    try {
      await addDoc(collection(db, 'transactions'), {
        ...formData,
        value: parseFloat(formData.value),
        date: new Date().toISOString(),
        status: formData.status,
        supplierId: formData.type === 'out' ? formData.supplierId : undefined,
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
      await updateDoc(doc(db, 'transactions', transaction.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Status atualizado para ${newStatus === 'paid' ? 'Pago' : 'Pendente'}`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar status.');
    }
  };

  const openReceipt = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    if (transaction.relatedOSId) {
      try {
        const osDoc = await getDoc(doc(db, 'serviceOrders', transaction.relatedOSId));
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

  const closeModal = () => setIsModalOpen(false);

  const categoryData = [
    { name: 'Entradas', value: summary.income, color: '#10b981' },
    { name: 'Saídas', value: summary.expense, color: '#ef4444' },
  ];

  return (
    <div className="space-y-8">
      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-2xl text-green-600">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Entradas (Pagas)</p>
          <h3 className="text-2xl font-black text-zinc-900">{formatCurrency(summary.income)}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-2xl text-red-600">
              <TrendingDown size={24} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Saídas (Pagas)</p>
          <h3 className="text-2xl font-black text-zinc-900">{formatCurrency(summary.expense)}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <ArrowUpRight size={24} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">A Receber</p>
          <h3 className="text-2xl font-black text-zinc-900">{formatCurrency(summary.receivable)}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-2xl text-orange-600">
              <ArrowDownRight size={24} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">A Pagar</p>
          <h3 className="text-2xl font-black text-zinc-900">{formatCurrency(summary.payable)}</h3>
        </div>
      </div>

      <div className="bg-zinc-900 p-8 rounded-3xl shadow-xl shadow-zinc-200 text-white flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400 mb-1">Saldo em Caixa (Efetivado)</p>
          <h3 className="text-4xl font-black">{formatCurrency(summary.balance)}</h3>
        </div>
        <div className="p-4 bg-white/10 rounded-2xl">
          <DollarSign size={32} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Transactions List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-zinc-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Fluxo de Caixa</h3>
                <p className="text-sm text-zinc-500">Histórico de movimentações</p>
              </div>
              <div className="flex items-center gap-2">
                {canCreate && (
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all"
                  >
                    <Plus size={16} />
                    Lançar
                  </button>
                )}
                <button className="p-2 bg-zinc-100 text-zinc-500 rounded-xl hover:bg-zinc-200 transition-all">
                  <Download size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar transação..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                />
              </div>
              <select 
                className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none"
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
              >
                <option value="all">Todos Tipos</option>
                <option value="in">Entradas</option>
                <option value="out">Saídas</option>
              </select>
              <select 
                className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              >
                <option value="all">Todos Status</option>
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                  <th className="px-8 py-4">Data</th>
                  <th className="px-8 py-4">Descrição</th>
                  <th className="px-8 py-4">Categoria</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Valor</th>
                  <th className="px-8 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-zinc-400 italic">Carregando transações...</td>
                  </tr>
                ) : filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-8 py-5 text-sm text-zinc-500">{format(new Date(t.date), 'dd/MM/yy')}</td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-zinc-900 block">{t.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">{t.paymentMethod}</span>
                        {t.supplierId && (
                          <>
                            <span className="text-zinc-300">|</span>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                              {suppliers.find(s => s.id === t.supplierId)?.name || 'Fornecedor'}
                            </span>
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
                      <button 
                        onClick={() => toggleStatus(t)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                          t.status === 'paid' 
                            ? "bg-green-100 text-green-700" 
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        )}
                      >
                        {t.status === 'paid' ? 'Pago' : 'Aguardando'}
                      </button>
                    </td>
                    <td className={cn(
                      "px-8 py-5 text-right font-black",
                      t.type === 'in' ? "text-green-600" : "text-red-600"
                    )}>
                      {t.type === 'in' ? '+' : '-'} {formatCurrency(t.value)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {t.status === 'paid' && t.type === 'in' && (
                        <button 
                          onClick={() => openReceipt(t)}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                          title="Gerar Comprovante"
                        >
                          <Download size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-zinc-400 italic">Nenhuma transação registrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <h3 className="text-xl font-bold text-zinc-900 mb-2">Distribuição</h3>
          <p className="text-sm text-zinc-500 mb-8">Proporção entre entradas e saídas</p>
          
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
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
                <span className="text-2xl font-black text-zinc-900">
                  {summary.income > 0 ? Math.round((summary.balance / summary.income) * 100) : 0}%
                </span>
                <div className="w-24 h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-zinc-900" 
                    style={{ width: `${summary.income > 0 ? Math.min(100, Math.max(0, (summary.balance / summary.income) * 100)) : 0}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">Lançamento Financeiro</h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
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
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'out' })}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                    formData.type === 'out' ? "bg-white text-red-600 shadow-sm" : "text-zinc-500"
                  )}
                >
                  Saída
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Valor (R$)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold"
                    placeholder="0.00"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
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
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
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
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Fornecedor</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  >
                    <option value="">Selecione um fornecedor (opcional)...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Categoria</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  placeholder="Ex: Peças, Aluguel, Salários..."
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Descrição</label>
                <textarea 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all min-h-[80px]"
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
                  className="flex-1 px-6 py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Receipt Modal */}
      {isReceiptModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-900 text-white">
              <div>
                <h3 className="text-xl font-bold">Comprovante de Serviço</h3>
                <p className="text-xs text-zinc-400 uppercase tracking-widest mt-1">Recibo de Pagamento</p>
              </div>
              <button onClick={closeReceipt} className="p-2 text-zinc-400 hover:text-white rounded-lg transition-all">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Header Info */}
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-2xl font-black text-zinc-900">AutoGestão SaaS</h4>
                  <p className="text-sm text-zinc-500">Soluções Automotivas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-zinc-900">Data: {format(new Date(selectedTransaction.date), 'dd/MM/yyyy HH:mm')}</p>
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
                    <p className="text-sm font-bold text-zinc-900">{selectedTransaction.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Método de Pagamento</p>
                    <p className="text-sm font-bold text-zinc-900 uppercase">{selectedTransaction.paymentMethod}</p>
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
                        {relatedOS.services?.map((s: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-medium text-zinc-900">{s.name}</td>
                            <td className="px-4 py-3 text-right font-bold text-zinc-900">{formatCurrency(s.price)}</td>
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
              <div className="flex justify-between items-center bg-zinc-900 text-white p-6 rounded-2xl">
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
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg"
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
