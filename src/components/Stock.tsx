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
import { db } from '../firebase';
import { StockMovement, InventoryItem, Supplier, UserProfile } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from './Auth';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const Stock: React.FC = () => {
  const { profile } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { canCreate } = usePermissions('stock');

  const [formData, setFormData] = useState({
    itemId: '',
    type: 'in' as 'in' | 'out',
    quantity: 0,
    reason: '',
    supplierId: '',
    cost: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'stockMovements'), orderBy('date', 'desc'));
    const unsubscribeMovements = onSnapshot(q, (snapshot) => {
      const list: StockMovement[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as StockMovement);
      });
      setMovements(list);
      setLoading(false);
    });

    const unsubscribeInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(list);
    });

    const unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const list: Supplier[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(list);
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => list.push({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(list);
    });

    return () => {
      unsubscribeMovements();
      unsubscribeInventory();
      unsubscribeSuppliers();
      unsubscribeUsers();
    };
  }, []);

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

      // 3. If it's an entry with cost, create a financial transaction (Accounts Payable)
      if (formData.type === 'in' && formData.cost > 0) {
        await addDoc(collection(db, 'transactions'), {
          type: 'out',
          value: formData.cost * formData.quantity,
          category: 'Estoque',
          description: `Entrada de Estoque: ${item.name} (${formData.quantity} un)`,
          date: new Date().toISOString(),
          status: 'pending', // Accounts Payable
          paymentMethod: 'Boleto'
        });
      }

      toast.success('Movimentação registrada com sucesso!');
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar movimentação.');
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
      cost: 0
    });
  };

  const getItemName = (id: string) => inventory.find(i => i.id === id)?.name || 'Item Excluído';
  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || '-';
  const getUserName = (id: string) => users.find(u => u.uid === id)?.name || 'Sistema';

  const filteredMovements = movements.filter(m => 
    getItemName(m.itemId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por item ou motivo..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {canCreate && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
          >
            <Plus size={20} />
            Nova Movimentação
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-200">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tipo</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Item</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Qtd</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Motivo</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fornecedor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-zinc-400 italic">Carregando movimentações...</td>
                </tr>
              ) : filteredMovements.length > 0 ? filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-900">{format(new Date(m.date), 'dd/MM/yyyy')}</span>
                      <span className="text-[10px] text-zinc-400">{format(new Date(m.date), 'HH:mm')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      m.type === 'in' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {m.type === 'in' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                      {m.type === 'in' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-zinc-900">{getItemName(m.itemId)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-zinc-900">{m.quantity} un</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-500">{m.reason}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-500">{getSupplierName(m.supplierId || '')}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-500">
                        {getUserName(m.userId).charAt(0)}
                      </div>
                      <span className="text-sm text-zinc-500">{getUserName(m.userId)}</span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-zinc-400 italic">Nenhuma movimentação registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
