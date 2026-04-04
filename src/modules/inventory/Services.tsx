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
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Service, InventoryItem, ServiceProduct, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency, cn, handleFirestoreError } from '../../utils';
import { toast } from 'sonner';
import { AppButton } from '../../components/ui/AppButton';
import { AppCard } from '../../components/ui/AppCard';
import { AppInput } from '../../components/ui/AppInput';
import { AppDialog } from '../../components/ui/AppDialog';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SearchBar } from '../../components/ui/SearchBar';

const Services: React.FC<{ setActiveTab?: (tab: string, itemId?: string) => void }> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
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
    precoCusto: '',
    laborCost: '0',
    tempoMedio: '',
    produtos: [] as ServiceProduct[]
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'catalogo_servicos'),
      where('empresaId', '==', profile.empresaId),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Service[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Service);
      });
      setServices(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'catalogo_servicos');
      setLoading(false);
    });

    const qInventory = query(
      collection(db, 'inventario'),
      where('empresaId', '==', profile.empresaId)
    );
    const unsubscribeInventory = onSnapshot(qInventory, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'inventario');
    });

    return () => {
      unsubscribe();
      unsubscribeInventory();
    };
  }, [profile]);

  useEffect(() => {
    const productCost = formData.produtos.reduce((acc, p) => {
      const item = inventory.find(i => i.id === p.itemInventarioId);
      return acc + (item ? item.precoVenda * p.quantidade : 0);
    }, 0);
    
    const totalCost = productCost + parseFloat(formData.laborCost || '0');
    setFormData(prev => ({ ...prev, precoCusto: totalCost.toFixed(2) }));
  }, [formData.produtos, formData.laborCost, inventory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) return;
    if (!formData.name || !formData.price) {
      toast.error('Nome e preço são obrigatórios.');
      return;
    }

    try {
      const data = {
        empresaId: profile.empresaId,
        name: formData.name,
        price: parseFloat(formData.price),
        precoCusto: parseFloat(formData.precoCusto || '0'),
        tempoMedio: formData.tempoMedio ? parseInt(formData.tempoMedio) : null,
        produtos: formData.produtos,
        updatedAt: serverTimestamp()
      };

      if (editingService) {
        await updateDoc(doc(db, 'catalogo_servicos', editingService.id), data);
        toast.success('Serviço atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'catalogo_servicos'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        toast.success('Serviço cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar serviço.');
    }
  };

  const handleDelete = async (id: string) => {
    setServiceToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    try {
      await deleteDoc(doc(db, 'catalogo_servicos', serviceToDelete));
      toast.success('Serviço excluído com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir serviço.');
    } finally {
      setServiceToDelete(null);
    }
  };

  const openModal = (service?: Service) => {
    if (service) {
      const productCost = (service.produtos || []).reduce((acc, p) => {
        const item = inventory.find(i => i.id === p.itemInventarioId);
        return acc + (item ? item.precoVenda * p.quantidade : 0);
      }, 0);

      setEditingService(service);
      setFormData({
        name: service.name,
        price: service.price.toString(),
        precoCusto: service.precoCusto?.toString() || '0',
        laborCost: Math.max(0, (service.precoCusto || 0) - productCost).toFixed(2),
        tempoMedio: service.tempoMedio?.toString() || '',
        produtos: service.produtos || []
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        price: '',
        precoCusto: '0',
        laborCost: '0',
        tempoMedio: '',
        produtos: []
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const addProductToService = (item: InventoryItem) => {
    if (formData.produtos.find(p => p.itemInventarioId === item.id)) return;
    setFormData(prev => ({
      ...prev,
      produtos: [...prev.produtos, { itemInventarioId: item.id, name: item.name, quantidade: 1 }]
    }));
  };

  const removeProductFromService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      produtos: prev.produtos.filter((_, i) => i !== index)
    }));
  };

  const updateProductQuantity = (index: number, quantidade: number) => {
    setFormData(prev => {
      const newProducts = [...prev.produtos];
      newProducts[index].quantidade = Math.max(1, quantidade);
      return { ...prev, produtos: newProducts };
    });
  };

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SearchBar 
          placeholder="Buscar por nome do serviço..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
        />
        {canCreate && (
          <AppButton 
            onClick={() => openModal()}
            variant="primary"
          >
            <Plus size={20} className="mr-2" />
            Novo Serviço
          </AppButton>
        )}
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400 italic">Carregando serviços...</div>
        ) : filteredServices.length > 0 ? filteredServices.map((service) => (
          <AppCard key={service.id} className="p-6 group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 shadow-sm border border-slate-200">
                  <Wrench size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{service.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <Clock size={12} />
                    {service.tempoMedio ? `${service.tempoMedio} min` : 'Tempo não definido'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button 
                    onClick={() => openModal(service)}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(service.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            {service.produtos && service.produtos.length > 0 && (
              <div className="mb-6 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produtos Utilizados</p>
                <div className="flex flex-wrap gap-2">
                  {service.produtos?.map((p, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-medium text-slate-600 flex items-center gap-1">
                      <Package size={10} /> {p.name} ({p.quantidade})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Custo</span>
                  <span className="text-sm font-bold">{formatCurrency(service.precoCusto || 0)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Margem</span>
                  <span className={cn(
                    "text-sm font-bold",
                    (service.price - (service.precoCusto || 0)) > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(service.price - (service.precoCusto || 0))}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900">
                  <DollarSign size={16} className="text-slate-400" />
                  <span className="text-xl font-black">{formatCurrency(service.price)}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preço Sugerido</span>
              </div>
            </div>
          </AppCard>
        )) : (
          <div className="col-span-full py-20 text-center text-slate-400 italic">Nenhum serviço encontrado.</div>
        )}
      </div>

      {/* Modal Form */}
      <AppDialog 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        title={editingService ? 'Editar Serviço' : 'Novo Serviço'}
        footer={
          <div className="flex items-center gap-4 w-full">
            <AppButton onClick={closeModal} variant="secondary" className="flex-1">
              Cancelar
            </AppButton>
            <AppButton onClick={() => document.getElementById('service-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))} variant="primary" className="flex-1">
              {editingService ? 'Salvar Alterações' : 'Cadastrar Serviço'}
            </AppButton>
          </div>
        }
      >
        <form id="service-form" onSubmit={handleSubmit} className="space-y-6">
          <AppInput 
            label="Nome do Serviço"
            required
            placeholder="Ex: Lavagem Completa"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Preço de Venda (R$)"
              type="number"
              required
              step="0.01"
              placeholder="0.00"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            />
            <AppInput 
              label="Tempo Médio (min)"
              type="number"
              placeholder="60"
              value={formData.tempoMedio}
              onChange={(e) => setFormData({ ...formData, tempoMedio: e.target.value })}
            />
          </div>

          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Composição de Custo</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AppInput 
                label="Mão de Obra (R$)"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.laborCost}
                onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
              />
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Custo de Produtos (R$)</label>
                <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-medium text-sm">
                  {formatCurrency(formData.produtos.reduce((acc, p) => {
                    const item = inventory.find(i => i.id === p.itemInventarioId);
                    return acc + (item ? item.precoVenda * p.quantidade : 0);
                  }, 0))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 uppercase tracking-widest">Custo Total</span>
              <span className="text-xl font-black text-slate-900">{formatCurrency(parseFloat(formData.precoCusto))}</span>
            </div>
          </div>

          {/* Products Selection */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Package size={16} /> Produtos Utilizados
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {inventory.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addProductToService(item)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-primary hover:text-white hover:border-primary transition-all"
                >
                  + {item.name}
                </button>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2">Quantidade</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {formData.produtos?.map((p, i) => (
                    <tr key={i} className="text-sm">
                      <td className="px-4 py-3 font-bold text-slate-900">{p.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => updateProductQuantity(i, p.quantidade - 1)}
                            className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-100"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-8 text-center font-bold">{p.quantidade}</span>
                          <button 
                            type="button"
                            onClick={() => updateProductQuantity(i, p.quantidade + 1)}
                            className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-100"
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
                  {formData.produtos.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic">Nenhum produto selecionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </AppDialog>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Serviço?"
        message="Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Services;
