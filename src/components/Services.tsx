import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Wrench, 
  Clock, 
  DollarSign, 
  Edit2, 
  Trash2, 
  XCircle,
  Filter,
  Package,
  Minus,
  AlertTriangle
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Service, InventoryItem, ServiceProduct } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';

const Services: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const { canCreate, canEdit, canDelete } = usePermissions('services');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost: '',
    laborCost: '0',
    averageTime: '',
    selectedProducts: [] as ServiceProduct[]
  });

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Service[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Service);
      });
      setServices(list);
      setLoading(false);
    });

    const unsubscribeInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(list);
    });

    return () => {
      unsubscribe();
      unsubscribeInventory();
    };
  }, []);

  useEffect(() => {
    const productCost = formData.selectedProducts.reduce((acc, p) => {
      const item = inventory.find(i => i.id === p.inventoryItemId);
      return acc + (item ? item.price * p.quantity : 0);
    }, 0);
    
    const totalCost = productCost + parseFloat(formData.laborCost || '0');
    setFormData(prev => ({ ...prev, cost: totalCost.toFixed(2) }));
  }, [formData.selectedProducts, formData.laborCost, inventory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price) {
      toast.error('Nome e preço são obrigatórios.');
      return;
    }

    try {
      const data = {
        name: formData.name,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost || '0'),
        averageTime: formData.averageTime ? parseInt(formData.averageTime) : null,
        products: formData.selectedProducts
      };

      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), data);
        toast.success('Serviço atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'services'), data);
        toast.success('Serviço cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar serviço.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este serviço?')) {
      try {
        await deleteDoc(doc(db, 'services', id));
        toast.success('Serviço excluído com sucesso!');
      } catch (error) {
        console.error(error);
        toast.error('Erro ao excluir serviço.');
      }
    }
  };

  const openModal = (service?: Service) => {
    if (service) {
      const productCost = (service.products || []).reduce((acc, p) => {
        const item = inventory.find(i => i.id === p.inventoryItemId);
        return acc + (item ? item.price * p.quantity : 0);
      }, 0);

      setEditingService(service);
      setFormData({
        name: service.name,
        price: service.price.toString(),
        cost: service.cost?.toString() || '0',
        laborCost: Math.max(0, (service.cost || 0) - productCost).toFixed(2),
        averageTime: service.averageTime?.toString() || '',
        selectedProducts: service.products || []
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        price: '',
        cost: '0',
        laborCost: '0',
        averageTime: '',
        selectedProducts: []
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const addProductToService = (item: InventoryItem) => {
    if (formData.selectedProducts.find(p => p.inventoryItemId === item.id)) return;
    setFormData(prev => ({
      ...prev,
      selectedProducts: [...prev.selectedProducts, { inventoryItemId: item.id, name: item.name, quantity: 1 }]
    }));
  };

  const removeProductFromService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectedProducts: prev.selectedProducts.filter((_, i) => i !== index)
    }));
  };

  const updateProductQuantity = (index: number, quantity: number) => {
    setFormData(prev => {
      const newProducts = [...prev.selectedProducts];
      newProducts[index].quantity = Math.max(1, quantity);
      return { ...prev, selectedProducts: newProducts };
    });
  };

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome do serviço..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canCreate && (
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
          >
            <Plus size={20} />
            Novo Serviço
          </button>
        )}
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Carregando serviços...</div>
        ) : filteredServices.length > 0 ? filteredServices.map((service) => (
          <div key={service.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 shadow-sm border border-zinc-200">
                  <Wrench size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">{service.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    <Clock size={12} />
                    {service.averageTime ? `${service.averageTime} min` : 'Tempo não definido'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button 
                    onClick={() => openModal(service)}
                    className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(service.id)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            {service.products && service.products.length > 0 && (
              <div className="mb-6 space-y-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Produtos Utilizados</p>
                <div className="flex flex-wrap gap-2">
                  {service.products?.map((p, i) => (
                    <span key={i} className="px-2 py-1 bg-zinc-50 border border-zinc-100 rounded text-[10px] font-medium text-zinc-600 flex items-center gap-1">
                      <Package size={10} /> {p.name} ({p.quantity})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-500">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Custo</span>
                  <span className="text-sm font-bold">{formatCurrency(service.cost || 0)}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Margem</span>
                  <span className={cn(
                    "text-sm font-bold",
                    (service.price - (service.cost || 0)) > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(service.price - (service.cost || 0))}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-900">
                  <DollarSign size={16} className="text-zinc-400" />
                  <span className="text-xl font-black">{formatCurrency(service.price)}</span>
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Preço Sugerido</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Nenhum serviço encontrado.</div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">
                {editingService ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Nome do Serviço</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  placeholder="Ex: Lavagem Completa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Preço de Venda (R$)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold text-lg"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Tempo Médio (min)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="60"
                    value={formData.averageTime}
                    onChange={(e) => setFormData({ ...formData, averageTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-200 space-y-4">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Composição de Custo</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Mão de Obra (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      placeholder="0.00"
                      value={formData.laborCost}
                      onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Custo de Produtos (R$)</label>
                    <div className="w-full px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-600 font-medium">
                      {formatCurrency(formData.selectedProducts.reduce((acc, p) => {
                        const item = inventory.find(i => i.id === p.inventoryItemId);
                        return acc + (item ? item.price * p.quantity : 0);
                      }, 0))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Custo Total</span>
                  <span className="text-xl font-black text-zinc-900">{formatCurrency(parseFloat(formData.cost))}</span>
                </div>
              </div>

              {/* Products Selection */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                  <Package size={16} /> Produtos Utilizados
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {inventory.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addProductToService(item)}
                      className="px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all"
                    >
                      + {item.name}
                    </button>
                  ))}
                </div>

                <div className="bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200">
                        <th className="px-4 py-2">Produto</th>
                        <th className="px-4 py-2">Quantidade</th>
                        <th className="px-4 py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {formData.selectedProducts?.map((p, i) => (
                        <tr key={i} className="text-sm">
                          <td className="px-4 py-3 font-bold text-zinc-900">{p.name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button 
                                type="button"
                                onClick={() => updateProductQuantity(i, p.quantity - 1)}
                                className="p-1 bg-white border border-zinc-200 rounded hover:bg-zinc-100"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-8 text-center font-bold">{p.quantity}</span>
                              <button 
                                type="button"
                                onClick={() => updateProductQuantity(i, p.quantity + 1)}
                                className="p-1 bg-white border border-zinc-200 rounded hover:bg-zinc-100"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button 
                              type="button"
                              onClick={() => removeProductFromService(i)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <XCircle size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formData.selectedProducts.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-zinc-400 italic">Nenhum produto selecionado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
                  {editingService ? 'Salvar Alterações' : 'Cadastrar Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
