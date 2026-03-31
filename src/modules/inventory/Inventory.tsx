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
  ArrowUpCircle,
  DollarSign,
  Layers,
  Truck,
  History,
  Tag,
  Sparkles,
  Loader2
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { InventoryItem, Supplier, OperationType } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../auth/Auth';
import { formatCurrency, cn, handleFirestoreError } from '../../utils';
import { toast } from 'sonner';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { generateAIResponse } from '../../services/gemini';
import { motion, AnimatePresence } from 'motion/react';

const Inventory: React.FC<{ setActiveTab?: (tab: string, itemId?: string, supplierId?: string, itemStatus?: any) => void }> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const { canCreate, canEdit, canDelete } = usePermissions('inventory');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    quantity: '',
    minQuantity: '',
    precoVenda: '',
    custoMedio: '',
    fornecedorId: '',
    category: '',
    location: '',
    unit: 'un'
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'inventario'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('name', 'asc')
    );
    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setItems(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'inventario');
      setLoading(false);
    });

    const unsubscribeSuppliers = onSnapshot(
      query(collection(db, 'fornecedores'), where('empresaId', '==', profile.empresaId)), 
      (snapshot) => {
        const list: Supplier[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Supplier);
        });
        setSuppliers(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'fornecedores');
      }
    );

    return () => {
      unsubscribeItems();
      unsubscribeSuppliers();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.quantity || !formData.precoVenda) {
      toast.error('Nome, quantidade e preço são obrigatórios.');
      return;
    }

    if (!profile) return;

    try {
      const data = {
        empresaId: profile.empresaId,
        name: formData.name,
        sku: formData.sku,
        barcode: formData.barcode,
        quantidadeAtual: parseFloat(formData.quantity),
        quantidadeReservada: editingItem?.quantidadeReservada || 0,
        estoqueMinimo: formData.minQuantity ? parseFloat(formData.minQuantity) : 0,
        precoVenda: parseFloat(formData.precoVenda),
        custoMedio: formData.custoMedio ? parseFloat(formData.custoMedio) : 0,
        fornecedorPadraoId: formData.fornecedorId,
        category: formData.category,
        location: formData.location,
        unit: formData.unit,
        updatedAt: new Date().toISOString()
      };

      if (editingItem) {
        await updateDoc(doc(db, 'inventario', editingItem.id), data);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'inventario'), {
          ...data,
          quantidadeReservada: 0,
          createdAt: new Date().toISOString()
        });
        toast.success('Produto cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar produto.');
    }
  };

  const handleDelete = async (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'inventario', itemToDelete));
      toast.success('Produto excluído com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir produto.');
    } finally {
      setItemToDelete(null);
    }
  };

  const openModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        sku: item.sku || '',
        barcode: item.barcode || '',
        quantity: item.quantidadeAtual.toString(),
        minQuantity: item.estoqueMinimo.toString(),
        precoVenda: item.precoVenda.toString(),
        custoMedio: item.custoMedio?.toString() || '',
        fornecedorId: item.fornecedorPadraoId || '',
        category: item.category || '',
        location: item.location || '',
        unit: item.unit || 'un'
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        quantity: '',
        minQuantity: '',
        precoVenda: '',
        custoMedio: '',
        fornecedorId: '',
        category: '',
        location: '',
        unit: 'un'
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

  const totalInventoryValue = filteredItems.reduce((acc, item) => acc + (item.quantidadeAtual * (item.custoMedio || 0)), 0);

  const lowStockItems = items.filter(item => item.quantidadeAtual <= item.estoqueMinimo);

  const handleGenerateAISuggestion = async () => {
    if (lowStockItems.length === 0) {
      toast.info('Não há itens com estoque baixo para analisar.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const itemsList = lowStockItems.map(item => `- ${item.name}: Atual ${item.quantidadeAtual}, Mínimo ${item.estoqueMinimo}`).join('\n');
      const prompt = `
        Abaixo está uma lista de itens com estoque baixo em uma oficina mecânica:
        ${itemsList}
        
        Sugira quantidades de reposição para cada item, considerando que o objetivo é manter um estoque de segurança de pelo menos 50% acima do mínimo.
        Forneça uma lista curta e direta.
      `;

      const response = await generateAIResponse(prompt, 'Estoque');
      setAiSuggestion(response || null);
      toast.success('Sugestões de reposição geradas!');
    } catch (error) {
      toast.error('Erro ao gerar sugestões de IA.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const calculateABCCurve = async () => {
    if (items.length === 0) return;

    try {
      // Calculate total value for each item
      const itemsWithValue = items.map(item => ({
        ...item,
        totalValue: item.quantidadeAtual * (item.custoMedio || 0)
      }));

      // Sort by value descending
      itemsWithValue.sort((a, b) => b.totalValue - a.totalValue);

      const totalInventoryValue = itemsWithValue.reduce((acc, item) => acc + item.totalValue, 0);
      let cumulativeValue = 0;

      const updates = itemsWithValue.map(item => {
        cumulativeValue += item.totalValue;
        const percentage = (cumulativeValue / totalInventoryValue) * 100;
        
        let abcCategory: 'A' | 'B' | 'C' = 'C';
        if (percentage <= 70) abcCategory = 'A';
        else if (percentage <= 90) abcCategory = 'B';

        return updateDoc(doc(db, 'inventario', item.id), { abcCategory });
      });

      await Promise.all(updates);
      toast.success('Curva ABC recalculada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao calcular Curva ABC.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* AI Suggestion Result */}
      <AnimatePresence>
        {aiSuggestion && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-accent text-accent-foreground p-6 sm:p-8 rounded-3xl border border-accent/20 shadow-2xl relative overflow-hidden group"
          >
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Sparkles size={20} className="text-amber-400" />
                </div>
                <h3 className="text-lg font-bold">Sugestões de Reposição (IA)</h3>
              </div>
              <button 
                onClick={() => setAiSuggestion(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle size={20} className="text-zinc-500" />
              </button>
            </div>
            <div className="text-sm sm:text-base text-zinc-300 leading-relaxed relative z-10 whitespace-pre-line">
              {aiSuggestion}
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total de Itens</p>
          <h3 className="text-2xl font-black text-zinc-900">{filteredItems.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Itens com Estoque Baixo</p>
          <h3 className="text-2xl font-black text-red-600">{filteredItems.filter(i => i.quantidadeAtual <= i.estoqueMinimo).length}</h3>
        </div>
        <div className="bg-accent p-6 rounded-3xl shadow-lg shadow-accent/20 text-accent-foreground">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Valor Total em Estoque (Custo)</p>
          <h3 className="text-2xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInventoryValue)}</h3>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-3xl">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome do produto..." 
            className="w-full pl-12 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {lowStockItems.length > 0 && (
            <button
              onClick={handleGenerateAISuggestion}
              disabled={isGeneratingAI}
              className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-4 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm w-full sm:w-auto disabled:opacity-50"
            >
              {isGeneratingAI ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} className="text-amber-400" />
              )}
              IA: Reposição
            </button>
          )}
          <button 
            onClick={calculateABCCurve}
            className="flex items-center justify-center gap-2 bg-white border border-zinc-200 text-zinc-500 px-4 py-3 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm text-sm w-full sm:w-auto"
          >
            <Layers size={20} />
            Curva ABC
          </button>
          <button 
            onClick={() => setActiveTab?.('stock')}
            className="flex items-center justify-center gap-2 bg-white border border-zinc-200 text-zinc-500 px-4 py-3 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm text-sm w-full sm:w-auto"
          >
            <History size={20} />
            Histórico
          </button>
          {canCreate && (
            <button 
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm w-full sm:w-auto"
            >
              <Plus size={20} />
              Novo Produto
            </button>
          )}
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-400 text-sm italic">Carregando estoque...</p>
            </div>
          </div>
        ) : filteredItems.length > 0 ? filteredItems.map((item) => {
          const isLow = item.quantidadeAtual <= item.estoqueMinimo;
          return (
            <div key={item.id} className={cn(
              "bg-white p-6 rounded-[2rem] border shadow-sm hover:shadow-xl hover:shadow-zinc-100 transition-all group relative overflow-hidden",
              isLow ? "border-red-200 bg-red-50/30" : "border-zinc-200"
            )}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border transition-transform group-hover:scale-105",
                    isLow ? "bg-red-100 text-red-600 border-red-200" : "bg-accent text-accent-foreground border-accent/20"
                  )}>
                    <Package size={28} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 line-clamp-1">{item.name}</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{item.category || 'Sem Categoria'}</p>
                      {item.abcCategory && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                          item.abcCategory === 'A' ? "bg-green-100 text-green-700" :
                          item.abcCategory === 'B' ? "bg-blue-100 text-blue-700" :
                          "bg-zinc-100 text-zinc-700"
                        )}>
                          Curva {item.abcCategory}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {setActiveTab && (
                    <button 
                      onClick={() => setActiveTab('stock', item.id)}
                      className="p-2 text-accent hover:bg-accent/10 rounded-xl transition-all"
                      title="Lançar Estoque"
                    >
                      <ArrowUpCircle size={16} />
                    </button>
                  )}
                  {canEdit && (
                    <button 
                      onClick={() => openModal(item)}
                      className="p-2 text-zinc-400 hover:text-accent hover:bg-zinc-100 rounded-xl transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Preço Venda</p>
                  <p className="text-sm font-black text-zinc-900">{formatCurrency(item.precoVenda)}</p>
                </div>
                <div className={cn(
                  "rounded-2xl p-3 border",
                  isLow ? "bg-red-100/50 border-red-200" : "bg-zinc-50 border-zinc-100"
                )}>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Estoque Disponível</p>
                  <p className={cn(
                    "text-sm font-black",
                    isLow ? "text-red-600" : "text-zinc-900"
                  )}>
                    {item.quantidadeAtual} {item.unit || 'un'}
                  </p>
                  {item.quantidadeReservada > 0 && (
                    <p className="text-[8px] font-bold text-amber-600 uppercase mt-1">
                      Reservado: {item.quantidadeReservada}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Custo Médio</span>
                  <span className="text-xs font-bold text-zinc-600">{formatCurrency(item.custoMedio || 0)}</span>
                </div>
                {isLow && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">
                    <AlertTriangle size={12} />
                    Reposição Necessária
                  </span>
                )}
              </div>

              <button
                onClick={() => setActiveTab?.('stock', item.id)}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-zinc-50 text-zinc-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition-all border border-zinc-100"
              >
                <History size={14} />
                Histórico de Movimentações
              </button>
            </div>
          );
        }) : (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-2 opacity-40">
              <Package size={48} className="text-zinc-300" />
              <p className="text-zinc-500 text-sm font-medium">Nenhum produto encontrado.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-xl font-black text-zinc-900">
                  {editingItem ? 'Editar Produto' : 'Novo Produto'}
                </h3>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Informações do Item</p>
              </div>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-accent rounded-xl hover:bg-zinc-100 transition-all">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nome do Produto</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="Ex: Óleo 5W30"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">SKU / Código</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="Ex: OLE-5W30-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Código de Barras</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="EAN-13"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Unidade</label>
                  <select 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-bold"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="lt">Litro (lt)</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="mt">Metro (mt)</option>
                    <option value="cj">Conjunto (cj)</option>
                    <option value="pc">Peça (pc)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Quantidade Atual</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Estoque Mínimo</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="0"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Preço Venda (R$)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="0.00"
                    value={formData.precoVenda}
                    onChange={(e) => setFormData({ ...formData, precoVenda: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Custo (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="0.00"
                    value={formData.custoMedio}
                    onChange={(e) => setFormData({ ...formData, custoMedio: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Categoria</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="Ex: Peças, Fluidos..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Localização</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="Ex: Prateleira A1"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Fornecedor</label>
                  <select 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-bold"
                    value={formData.fornecedorId}
                    onChange={(e) => setFormData({ ...formData, fornecedorId: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

              <div className="pt-4 flex items-center gap-4">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-4 border border-zinc-200 text-zinc-600 font-bold rounded-2xl hover:bg-zinc-50 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-accent text-accent-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm"
                >
                  {editingItem ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Produto?"
        message="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Inventory;
