import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  XCircle,
  Filter,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Layers,
  Truck,
  History,
  Tag
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { InventoryItem, Supplier, OperationType } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from './Auth';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';

const Inventory: React.FC<{ setActiveTab?: (tab: string, itemId?: string) => void }> = ({ setActiveTab }) => {
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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { canCreate, canEdit, canDelete } = usePermissions('inventory');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    minQuantity: '',
    price: '',
    cost: '',
    supplierId: '',
    category: ''
  });

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setItems(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'inventory');
      setLoading(false);
    });

    const unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const list: Supplier[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Supplier);
      });
      setSuppliers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'suppliers');
    });

    return () => {
      unsubscribeItems();
      unsubscribeSuppliers();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.quantity || !formData.price) {
      toast.error('Nome, quantidade e preço são obrigatórios.');
      return;
    }

    try {
      const data = {
        name: formData.name,
        quantity: parseFloat(formData.quantity),
        minQuantity: formData.minQuantity ? parseFloat(formData.minQuantity) : 0,
        price: parseFloat(formData.price),
        cost: formData.cost ? parseFloat(formData.cost) : 0,
        supplierId: formData.supplierId,
        category: formData.category
      };

      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), data);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'inventory'), data);
        toast.success('Produto cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar produto.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await deleteDoc(doc(db, 'inventory', id));
        toast.success('Produto excluído com sucesso!');
      } catch (error) {
        console.error(error);
        toast.error('Erro ao excluir produto.');
      }
    }
  };

  const openModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        quantity: item.quantity.toString(),
        minQuantity: item.minQuantity.toString(),
        price: item.price.toString(),
        cost: item.cost?.toString() || '',
        supplierId: item.supplierId || '',
        category: item.category || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        quantity: '',
        minQuantity: '',
        price: '',
        cost: '',
        supplierId: '',
        category: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalInventoryValue = filteredItems.reduce((acc, item) => acc + (item.quantity * (item.cost || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total de Itens</p>
          <h3 className="text-2xl font-black text-zinc-900">{filteredItems.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Itens com Estoque Baixo</p>
          <h3 className="text-2xl font-black text-red-600">{filteredItems.filter(i => i.quantity <= i.minQuantity).length}</h3>
        </div>
        <div className="bg-zinc-900 p-6 rounded-3xl shadow-lg shadow-zinc-200 text-white">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Valor Total em Estoque (Custo)</p>
          <h3 className="text-2xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInventoryValue)}</h3>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 justify-end">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome do produto..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => setActiveTab?.('stock')}
            className="flex items-center justify-center gap-2 bg-white border border-zinc-200 text-zinc-600 px-6 py-3 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <History size={20} />
            Histórico Global
          </button>

          {canCreate && (
            <button 
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
            >
              <Plus size={20} />
              Novo Produto
            </button>
          )}
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Carregando estoque...</div>
        ) : filteredItems.length > 0 ? filteredItems.map((item) => {
          const isLow = item.quantity <= item.minQuantity;
          return (
            <div key={item.id} className={cn(
              "bg-white p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all group",
              isLow ? "border-red-200 bg-red-50/30" : "border-zinc-200"
            )}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border",
                    isLow ? "bg-red-100 text-red-600 border-red-200" : "bg-zinc-100 text-zinc-900 border-zinc-200"
                  )}>
                    <Package size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn(
                        "text-lg font-bold",
                        isLow ? "text-red-700" : "text-zinc-900"
                      )}>{item.name}</h3>
                      {isLow && <AlertTriangle size={16} className="text-red-600 animate-pulse" />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={cn(
                        "flex items-center gap-2 text-xs font-bold uppercase tracking-widest",
                        isLow ? "text-red-400" : "text-zinc-400"
                      )}>
                        <Layers size={12} />
                        {item.quantity} unidades
                      </div>
                      {item.category && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          <Tag size={10} />
                          {item.category}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEdit && (
                    <button 
                      onClick={() => openModal(item)}
                      className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-6 space-y-2">
                {isLow && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-600 text-xs font-bold">
                    <AlertTriangle size={14} />
                    Estoque abaixo do mínimo ({item.minQuantity})
                  </div>
                )}
                {item.supplierId && (
                  <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center gap-2 text-zinc-500 text-xs font-bold">
                    <Truck size={14} />
                    Fornecedor: {suppliers.find(s => s.id === item.supplierId)?.name || 'N/A'}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-100 grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Preço Venda</p>
                  <div className="flex items-center gap-1 text-zinc-900">
                    <DollarSign size={14} className="text-zinc-400" />
                    <span className="text-lg font-black">{formatCurrency(item.price)}</span>
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Custo Médio</p>
                  <div className="flex items-center justify-end gap-1 text-zinc-500">
                    <span className="text-sm font-bold">{formatCurrency(item.cost || 0)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveTab?.('stock', item.id)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-50 text-zinc-600 rounded-2xl text-xs font-bold hover:bg-zinc-100 transition-all border border-zinc-100"
              >
                <History size={16} />
                Ver Histórico de Movimentações
              </button>
            </div>
          );
        }) : (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Nenhum produto encontrado.</div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">
                {editingItem ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Nome do Produto</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  placeholder="Ex: Óleo 5W30"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Quantidade Atual</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Estoque Mínimo</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="0"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Preço Venda (R$)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Custo (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="0.00"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Categoria</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="Ex: Peças, Fluidos..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Fornecedor</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
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
                  {editingItem ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
