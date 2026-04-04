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
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchBar } from '../../components/ui/SearchBar';
import { AppButton } from '../../components/ui/AppButton';
import { AppCard } from '../../components/ui/AppCard';
import { AppInput } from '../../components/ui/AppInput';
import { AppDialog } from '../../components/ui/AppDialog';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
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
  const [aiSuggestions, setAiSuggestions] = useState<{ itemName: string; itemId: string; suggestedQuantity: number; reasoning: string }[]>([]);
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
      const itemsList = lowStockItems.map(item => ({
        id: item.id,
        name: item.name,
        current: item.quantidadeAtual,
        min: item.estoqueMinimo,
        abc: item.abcCategory || 'N/A',
        unit: item.unit || 'un'
      }));

      const prompt = `
        Analise os seguintes itens com estoque baixo em uma oficina mecânica e sugira quantidades de reposição ideais.
        Considere que itens de Categoria A (alto giro/valor) devem ter uma margem de segurança maior (ex: 100% acima do mínimo).
        Itens B (médio giro) devem ter 50% acima do mínimo.
        Itens C (baixo giro) devem ter apenas o suficiente para atingir o mínimo + 20%.
        
        Itens para análise:
        ${JSON.stringify(itemsList, null, 2)}
        
        Retorne APENAS um array JSON com a seguinte estrutura, sem blocos de código ou explicações extras:
        [
          { "itemId": "id_do_item", "itemName": "Nome do Item", "suggestedQuantity": 10, "reasoning": "Breve explicação do porquê desta quantidade" }
        ]
      `;

      const response = await generateAIResponse(prompt, 'Estoque');
      
      // Try to parse JSON from the response
      try {
        const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedSuggestions = JSON.parse(cleanResponse);
        setAiSuggestions(parsedSuggestions);
        toast.success('Sugestões de reposição geradas com sucesso!');
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Fallback to old behavior if parsing fails
        setAiSuggestions([]);
        toast.error('Ocorreu um erro ao processar as sugestões da IA.');
      }
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
    <div className="space-y-8 sm:space-y-12 animate-in">
      <PageHeader 
        title="Inventário" 
        description="Controle seu estoque de peças e suprimentos."
        action={canCreate && (
          <AppButton onClick={() => openModal()} variant="primary">
            <Plus size={18} className="mr-2" />
            Novo Produto
          </AppButton>
        )}
      />

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <SearchBar 
          placeholder="Buscar por nome, SKU ou categoria..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
        />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <AppButton variant="secondary" className="flex-1 sm:flex-none">
            <Filter size={18} className="mr-2" />
            Filtros
          </AppButton>
          {lowStockItems.length > 0 && (
            <AppButton 
              variant="secondary" 
              onClick={handleGenerateAISuggestion}
              disabled={isGeneratingAI}
              className="flex-1 sm:flex-none"
            >
              {isGeneratingAI ? <Loader2 size={18} className="animate-spin mr-2" /> : <Sparkles size={18} className="text-amber-400 mr-2" />}
              IA: Reposição
            </AppButton>
          )}
        </div>
      </div>

      {aiSuggestions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/20 rounded-3xl p-6 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={120} className="text-primary" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles size={20} />
                <span className="text-xs font-black uppercase tracking-widest">Sugestões Inteligentes de Reposição</span>
              </div>
              <button 
                onClick={() => setAiSuggestions([])}
                className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-1.5 rounded-full border border-slate-100 shadow-sm"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aiSuggestions.map((suggestion, idx) => (
                <AppCard key={idx} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight line-clamp-1">{suggestion.itemName}</h5>
                    <StatusBadge variant="primary" className="text-[10px]" label={`+${suggestion.suggestedQuantity}`} />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed italic mb-3">
                    {suggestion.reasoning}
                  </p>
                  <AppButton 
                    variant="secondary" 
                    size="sm" 
                    className="w-full text-[9px] h-8"
                    onClick={() => {
                      const item = items.find(i => i.id === suggestion.itemId);
                      if (item) openModal(item);
                    }}
                  >
                    Ver Produto
                  </AppButton>
                </AppCard>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-primary/10 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 font-medium italic">
                * As sugestões são baseadas na curva ABC e níveis de estoque atuais.
              </p>
              <AppButton 
                variant="primary" 
                size="sm" 
                className="text-[10px] h-8"
                onClick={() => {
                  toast.info('Funcionalidade de Pedido de Compra Automático em desenvolvimento.');
                }}
              >
                Gerar Pedido de Compra
              </AppButton>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AppCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Itens</p>
            <h4 className="text-xl font-black text-slate-900">{items.length}</h4>
          </div>
        </AppCard>
        <AppCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor em Estoque</p>
            <h4 className="text-xl font-black text-slate-900">
              {formatCurrency(items.reduce((acc, item) => acc + (item.quantidadeAtual * (item.custoMedio || 0)), 0))}
            </h4>
          </div>
        </AppCard>
        <AppCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estoque Baixo</p>
            <h4 className="text-xl font-black text-amber-600">
              {items.filter(i => i.quantidadeAtual <= (i.estoqueMinimo || 0)).length}
            </h4>
          </div>
        </AppCard>
        <AppCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categorias</p>
            <h4 className="text-xl font-black text-slate-900">
              {new Set(items.map(i => i.category)).size}
            </h4>
          </div>
        </AppCard>
      </div>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm italic">Carregando inventário...</p>
            </div>
          </div>
        ) : filteredItems.length > 0 ? filteredItems.map((item) => {
          const isLow = item.quantidadeAtual <= (item.estoqueMinimo || 0);
          
          return (
            <AppCard 
              key={item.id} 
              className={cn(
                "group relative overflow-hidden p-6",
                isLow && "border-red-200 bg-red-50/30"
              )}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform",
                    isLow ? "bg-red-100 text-red-600" : "bg-primary text-white"
                  )}>
                    <Package size={28} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 line-clamp-1">{item.name}</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.category || 'Sem Categoria'}</p>
                      {item.abcCategory && (
                        <StatusBadge 
                          variant={item.abcCategory === 'A' ? 'success' : item.abcCategory === 'B' ? 'primary' : 'secondary'} 
                          className="text-[8px]"
                          label={`Curva ${item.abcCategory}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {setActiveTab && (
                    <button 
                      onClick={() => setActiveTab('stock', item.id)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"
                      title="Lançar Estoque"
                    >
                      <ArrowUpCircle size={16} />
                    </button>
                  )}
                  {canEdit && (
                    <button 
                      onClick={() => openModal(item)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-xl transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Preço Venda</p>
                  <p className="text-sm font-black text-slate-900">{formatCurrency(item.precoVenda)}</p>
                </div>
                <div className={cn(
                  "rounded-2xl p-3 border",
                  isLow ? "bg-red-100/50 border-red-200" : "bg-slate-50 border-slate-100"
                )}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estoque Disponível</p>
                  <p className={cn(
                    "text-sm font-black",
                    isLow ? "text-red-600" : "text-slate-900"
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

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo Médio</span>
                  <span className="text-xs font-bold text-slate-600">{formatCurrency(item.custoMedio || 0)}</span>
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
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
              >
                <History size={14} />
                Histórico de Movimentações
              </button>
            </AppCard>
          );
        }) : (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-2 opacity-40">
              <Package size={48} className="text-slate-300" />
              <p className="text-slate-500 text-sm font-medium">Nenhum produto encontrado.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      <AppDialog 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        title={editingItem ? 'Editar Produto' : 'Novo Produto'}
        footer={
          <div className="flex items-center gap-4 w-full">
            <AppButton onClick={closeModal} variant="secondary" className="flex-1">
              Cancelar
            </AppButton>
            <AppButton onClick={() => document.getElementById('inventory-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))} variant="primary" className="flex-1">
              {editingItem ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </AppButton>
          </div>
        }
      >
        <form id="inventory-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Nome do Produto"
              required
              placeholder="Ex: Óleo 5W30"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <AppInput 
              label="SKU / Código"
              placeholder="Ex: OLE-5W30-001"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Código de Barras"
              placeholder="EAN-13"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            />
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Unidade</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
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
            <AppInput 
              label="Quantidade Atual"
              type="number"
              required
              step="0.01"
              placeholder="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            />
            <AppInput 
              label="Estoque Mínimo"
              type="number"
              step="0.01"
              placeholder="0"
              value={formData.minQuantity}
              onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Preço Venda (R$)"
              type="number"
              required
              step="0.01"
              placeholder="0.00"
              value={formData.precoVenda}
              onChange={(e) => setFormData({ ...formData, precoVenda: e.target.value })}
            />
            <AppInput 
              label="Custo (R$)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.custoMedio}
              onChange={(e) => setFormData({ ...formData, custoMedio: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Categoria"
              placeholder="Ex: Peças, Fluidos..."
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
            <AppInput 
              label="Localização"
              placeholder="Ex: Prateleira A1"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fornecedor</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
              value={formData.fornecedorId}
              onChange={(e) => setFormData({ ...formData, fornecedorId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </form>
      </AppDialog>

      <ConfirmDialog
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
