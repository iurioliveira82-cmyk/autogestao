import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Calendar, 
  Truck, 
  Package, 
  User,
  History,
  Filter
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { StockMovement, InventoryItem, Supplier, UserProfile, OperationType } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from './Auth';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface StockProps {
  initialItemId?: string;
  initialSupplierId?: string;
}

const Stock: React.FC<StockProps> = ({ initialItemId, initialSupplierId }) => {
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
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterItem, setFilterItem] = useState(initialItemId || 'all');
  const [filterSupplier, setFilterSupplier] = useState(initialSupplierId || 'all');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'movements' | 'items'>('movements');
  const { canView, canCreate } = usePermissions('stock');

  const [formData, setFormData] = useState({
    itemId: '',
    type: 'in' as 'in' | 'out',
    quantity: 0,
    reason: '',
    supplierId: '',
    cost: 0,
    createTransaction: false,
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (!profile || !canView) return;

    const unsubscribeMovements = onSnapshot(
      query(collection(db, 'stockMovements'), orderBy('date', 'desc')), 
      (snapshot) => {
        const list: StockMovement[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as StockMovement);
        });
        setMovements(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'stockMovements');
        setLoading(false);
      }
    );

    const unsubscribeInventory = onSnapshot(
      collection(db, 'inventory'), 
      (snapshot) => {
        const list: InventoryItem[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
        setInventory(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'inventory')
    );

    const unsubscribeSuppliers = onSnapshot(
      collection(db, 'suppliers'), 
      (snapshot) => {
        const list: Supplier[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Supplier));
        setSuppliers(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'suppliers')
    );

    const unsubscribeUsers = onSnapshot(
      collection(db, 'users'), 
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => list.push({ uid: doc.id, ...doc.data() } as UserProfile));
        setUsers(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );

    return () => {
      unsubscribeMovements();
      unsubscribeInventory();
      unsubscribeSuppliers();
      unsubscribeUsers();
    };
  }, [profile, canView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.itemId || formData.quantity <= 0 || !formData.reason) {
      toast.error('Item, quantidade e motivo são obrigatórios.');
      return;
    }

    if (!profile) return;

    try {
      const item = inventory.find(i => i.id === formData.itemId);
      if (!item) throw new Error('Item não encontrado');

      // If output, check if enough stock
      if (formData.type === 'out' && item.quantity < formData.quantity) {
        toast.error('Estoque insuficiente para esta saída.');
        return;
      }

      // 1. Create movement record
      await addDoc(collection(db, 'stockMovements'), {
        ...formData,
        userId: profile.uid,
        date: new Date().toISOString()
      });

      // 2. Update inventory quantity
      const itemRef = doc(db, 'inventory', formData.itemId);
      await updateDoc(itemRef, {
        quantity: increment(formData.type === 'in' ? formData.quantity : -formData.quantity),
        // Update cost if it's an entry
        ...(formData.type === 'in' && formData.cost > 0 ? { cost: formData.cost } : {})
      });

      // 3. If it's an entry with cost and createTransaction is true, create a financial transaction (Accounts Payable)
      if (formData.type === 'in' && formData.cost > 0 && formData.createTransaction) {
        const supplier = suppliers.find(s => s.id === formData.supplierId);
        await addDoc(collection(db, 'transactions'), {
          type: 'out',
          value: formData.cost * formData.quantity,
          category: 'Estoque',
          description: `Entrada de Estoque: ${item.name} (${formData.quantity} un)${supplier ? ` - Fornecedor: ${supplier.name}` : ''}`,
          date: new Date(formData.dueDate).toISOString(),
          status: 'pending', // Accounts Payable
          paymentMethod: 'Boleto',
          supplierId: formData.supplierId || undefined
        });
      }

      toast.success('Movimentação registrada com sucesso!');
      closeModal();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stockMovements');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      itemId: '',
      type: 'in',
      quantity: 0,
      reason: '',
      supplierId: '',
      cost: 0,
      createTransaction: false,
      dueDate: format(new Date(), 'yyyy-MM-dd')
    });
  };

  const getItemName = (id: string) => inventory.find(i => i.id === id)?.name || 'Item Excluído';
  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || '-';
  const getUserName = (id: string) => users.find(u => u.uid === id)?.name || 'Sistema';

  const filteredMovements = movements.filter(m => {
    const matchesSearch = getItemName(m.itemId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || m.type === filterType;
    const matchesUser = filterUser === 'all' || m.userId === filterUser;
    const matchesItem = filterItem === 'all' || m.itemId === filterItem;
    const matchesSupplier = filterSupplier === 'all' || m.supplierId === filterSupplier;
    
    const movementDate = new Date(m.date);
    const matchesStart = !dateRange.start || movementDate >= new Date(dateRange.start);
    const matchesEnd = !dateRange.end || movementDate <= new Date(dateRange.end + 'T23:59:59');
    
    return matchesSearch && matchesType && matchesUser && matchesItem && matchesSupplier && matchesStart && matchesEnd;
  });

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openHistory = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedItem(null);
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <Package size={48} className="mb-4" />
        <p className="text-lg font-medium">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 glass-card p-4 rounded-3xl">
        <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setViewMode('movements')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              viewMode === 'movements' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            Movimentações
          </button>
          <button
            onClick={() => setViewMode('items')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              viewMode === 'items' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            Saldos por Item
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 justify-end">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
              type="text" 
              placeholder={viewMode === 'movements' ? "Buscar por item ou motivo..." : "Buscar por item ou categoria..."}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {canCreate && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 text-sm"
            >
              <Plus size={20} />
              Nova Movimentação
            </button>
          )}
        </div>
      </div>

      {viewMode === 'movements' && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-2">
            <Calendar size={16} className="text-zinc-400" />
            <input 
              type="date" 
              className="text-xs font-black uppercase tracking-widest focus:outline-none bg-transparent"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <span className="text-zinc-300">|</span>
            <input 
              type="date" 
              className="text-xs font-black uppercase tracking-widest focus:outline-none bg-transparent"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
            >
              <option value="all">Todos Itens</option>
              {inventory.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>

            <select
              className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
            >
              <option value="all">Todos Fornecedores</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="all">Todos Tipos</option>
              <option value="in">Entradas</option>
              <option value="out">Saídas</option>
            </select>

            <select
              className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="all">Todos Usuários</option>
              {users.map(u => (
                <option key={u.uid} value={u.uid}>{u.name}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setFilterType('all');
                setFilterUser('all');
                setFilterItem('all');
                setFilterSupplier('all');
                setDateRange({ start: '', end: '' });
                setSearchTerm('');
              }}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 rounded-xl transition-all"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}

      {viewMode === 'movements' ? (
        <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tipo</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Item</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Qtd</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Motivo</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Fornecedor</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-zinc-400 text-xs font-black uppercase tracking-widest italic">Carregando movimentações...</p>
                    </td>
                  </tr>
                ) : filteredMovements.length > 0 ? filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-zinc-900">{format(new Date(m.date), 'dd/MM/yyyy')}</span>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{format(new Date(m.date), 'HH:mm')}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm border",
                        m.type === 'in' ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"
                      )}>
                        {m.type === 'in' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                        {m.type === 'in' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-zinc-900">{getItemName(m.itemId)}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-zinc-900">{m.quantity} un</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-zinc-500">{m.reason}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-zinc-500">{getSupplierName(m.supplierId || '')}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center text-[10px] font-black text-zinc-500 border border-zinc-200 group-hover:scale-110 transition-transform">
                          {getUserName(m.userId).charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-zinc-500">{getUserName(m.userId)}</span>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <Package size={48} className="mx-auto text-zinc-200 mb-4" />
                      <p className="text-zinc-400 text-xs font-black uppercase tracking-widest italic">Nenhuma movimentação registrada.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Item</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Categoria</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Saldo Atual</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Mínimo</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-zinc-400 text-xs font-black uppercase tracking-widest italic">Carregando itens...</p>
                    </td>
                  </tr>
                ) : filteredInventory.length > 0 ? filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-zinc-900">{item.name}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-zinc-500">{item.category || '-'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-sm font-black px-3 py-1 rounded-xl",
                        item.quantity <= item.minQuantity ? "bg-red-50 text-red-600 border border-red-100" : "bg-zinc-50 text-zinc-900 border border-zinc-100"
                      )}>
                        {item.quantity} un
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-zinc-400">{item.minQuantity} un</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        onClick={() => openHistory(item)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-all shadow-sm group-hover:scale-105"
                      >
                        <History size={14} />
                        Histórico
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <Package size={48} className="mx-auto text-zinc-200 mb-4" />
                      <p className="text-zinc-400 text-xs font-black uppercase tracking-widest italic">Nenhum item encontrado.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isHistoryModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-zinc-200 text-zinc-900">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">Histórico de Movimentações</h3>
                  <p className="text-sm text-zinc-500">{selectedItem.name}</p>
                </div>
              </div>
              <button onClick={closeHistoryModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} className="rotate-45" />
              </button>
            </div>

            <div className="p-0 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr className="border-b border-zinc-100">
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tipo</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Quantidade</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Motivo</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Usuário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {movements.filter(m => m.itemId === selectedItem.id).length > 0 ? (
                    movements.filter(m => m.itemId === selectedItem.id).map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50/30 transition-colors">
                        <td className="px-8 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-900">{format(new Date(m.date), 'dd/MM/yyyy')}</span>
                            <span className="text-[10px] text-zinc-400">{format(new Date(m.date), 'HH:mm')}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            m.type === 'in' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                          )}>
                            {m.type === 'in' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <span className={cn(
                            "text-sm font-bold",
                            m.type === 'in' ? "text-green-600" : "text-red-600"
                          )}>
                            {m.type === 'in' ? '+' : '-'}{m.quantity} un
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <span className="text-sm text-zinc-600">{m.reason}</span>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-500">
                              {getUserName(m.userId).charAt(0)}
                            </div>
                            <span className="text-xs text-zinc-500">{getUserName(m.userId)}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-zinc-400 italic">Nenhuma movimentação para este item.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-8 bg-zinc-50/50 border-t border-zinc-100 flex justify-end">
              <button 
                onClick={closeHistoryModal}
                className="px-8 py-3 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">Nova Movimentação de Estoque</h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Tipo de Movimento</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'in' })}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all border",
                        formData.type === 'in' 
                          ? "bg-green-50 text-green-600 border-green-200" 
                          : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      <ArrowUpCircle size={14} />
                      Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'out' })}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all border",
                        formData.type === 'out' 
                          ? "bg-red-50 text-red-600 border-red-200" 
                          : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      <ArrowDownCircle size={14} />
                      Saída
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Item do Estoque</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.itemId}
                    onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                  >
                    <option value="">Selecione um item...</option>
                    {inventory.map(i => (
                      <option key={i.id} value={i.id}>{i.name} (Saldo: {i.quantity})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Quantidade</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  />
                </div>
                {formData.type === 'in' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Custo Unitário (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {formData.type === 'in' && (
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
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Motivo / Observação</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all resize-none"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder={formData.type === 'in' ? "Ex: Compra de mercadoria, Devolução..." : "Ex: Uso em serviço, Ajuste de inventário..."}
                />
              </div>

              {formData.type === 'in' && (
                <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="createTransaction"
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      checked={formData.createTransaction}
                      onChange={(e) => setFormData({ ...formData, createTransaction: e.target.checked })}
                    />
                    <label htmlFor="createTransaction" className="text-sm font-bold text-zinc-700">Lançar no Financeiro (Contas a Pagar)</label>
                  </div>

                  {formData.createTransaction && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Data de Vencimento</label>
                      <input 
                        type="date" 
                        required
                        className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}

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
                  Confirmar Movimentação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;

// Helper to avoid TS error on XCircle in closeModal
const XCircle: React.FC<{ size: number, className?: string }> = ({ size, className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
  </svg>
);
