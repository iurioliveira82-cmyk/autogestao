import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Car, 
  DollarSign, 
  TrendingUp, 
  Edit2, 
  Trash2, 
  XCircle,
  Filter,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Tag
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { ResaleVehicle, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency, cn, handleFirestoreError } from '../../utils';
import { toast } from 'sonner';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';

interface ResaleProps {
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: any) => void;
}

const Resale: React.FC<ResaleProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<ResaleVehicle[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<ResaleVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const { canCreate, canEdit, canDelete } = usePermissions('resale');

  // Form state
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: '',
    precoCompra: '',
    precoVenda: '',
    status: 'available' as 'available' | 'reserved' | 'sold'
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'veiculos_revenda'),
      where('empresaId', '==', profile.empresaId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ResaleVehicle[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ResaleVehicle);
      });
      setVehicles(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'veiculos_revenda');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) return;
    if (!formData.brand || !formData.model || !formData.precoCompra) {
      toast.error('Marca, modelo e preço de compra são obrigatórios.');
      return;
    }

    try {
      const data = {
        empresaId: profile.empresaId,
        brand: formData.brand,
        model: formData.model,
        year: formData.year ? parseInt(formData.year) : null,
        precoCompra: parseFloat(formData.precoCompra),
        precoVenda: formData.precoVenda ? parseFloat(formData.precoVenda) : null,
        status: formData.status,
        updatedAt: serverTimestamp()
      };

      if (editingVehicle) {
        await updateDoc(doc(db, 'veiculos_revenda', editingVehicle.id), data);
        
        // If status changed to sold, create revenue transaction
        if (editingVehicle.status !== 'sold' && data.status === 'sold' && data.precoVenda) {
          await addDoc(collection(db, 'transacoes_financeiras'), {
            empresaId: profile.empresaId,
            type: 'in',
            value: data.precoVenda,
            category: 'Venda de Veículo',
            description: `Venda: ${data.brand} ${data.model} (${data.year || 'N/A'})`,
            date: new Date().toISOString(),
            status: 'paid',
            relatedId: editingVehicle.id,
            createdAt: serverTimestamp()
          });
          toast.success('Venda registrada no financeiro!');
          setActiveTab('finance');
        }
        
        toast.success('Veículo atualizado com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, 'veiculos_revenda'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        
        // Create expense transaction for the purchase
        await addDoc(collection(db, 'transacoes_financeiras'), {
          empresaId: profile.empresaId,
          type: 'out',
          value: data.precoCompra,
          category: 'Compra de Veículo',
          description: `Compra: ${data.brand} ${data.model} (${data.year || 'N/A'})`,
          date: new Date().toISOString(),
          status: 'paid',
          relatedId: docRef.id,
          createdAt: serverTimestamp()
        });
        toast.success('Compra registrada no financeiro!');
        
        toast.success('Veículo cadastrado para revenda!');
        setActiveTab('finance');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar veículo.');
    }
  };

  const handleDelete = async (id: string) => {
    setVehicleToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      await deleteDoc(doc(db, 'veiculos_revenda', vehicleToDelete));
      toast.success('Veículo excluído com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir veículo.');
    } finally {
      setVehicleToDelete(null);
    }
  };

  const openModal = (vehicle?: ResaleVehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year?.toString() || '',
        precoCompra: vehicle.precoCompra.toString(),
        precoVenda: vehicle.precoVenda?.toString() || '',
        status: vehicle.status
      });
    } else {
      setEditingVehicle(null);
      setFormData({
        brand: '',
        model: '',
        year: '',
        precoCompra: '',
        precoVenda: '',
        status: 'available'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const filteredVehicles = vehicles.filter(v => 
    v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusMap = {
    available: { label: 'Disponível', color: 'bg-green-50 text-green-600', icon: CheckCircle2 },
    reserved: { label: 'Reservado', color: 'bg-yellow-50 text-yellow-600', icon: Clock },
    sold: { label: 'Vendido', color: 'bg-zinc-100 text-zinc-600', icon: ShoppingBag },
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por marca ou modelo..." 
            className="input-modern pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canCreate && (
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20"
          >
            <Plus size={20} />
            Novo Veículo
          </button>
        )}
      </div>

      {/* Resale Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Carregando veículos...</div>
        ) : filteredVehicles.length > 0 ? filteredVehicles.map((vehicle) => {
          const status = statusMap[vehicle.status];
          const profit = vehicle.precoVenda ? vehicle.precoVenda - vehicle.precoCompra : 0;
          
          return (
            <div key={vehicle.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 shadow-sm border border-zinc-200">
                    <Car size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">{vehicle.brand} {vehicle.model}</h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      <Tag size={12} />
                      {vehicle.year || 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEdit && (
                    <button 
                      onClick={() => openModal(vehicle)}
                      className="p-2 text-zinc-400 hover:text-accent hover:bg-zinc-100 rounded-lg transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(vehicle.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", status.color)}>
                  <status.icon size={12} />
                  {status.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Compra</p>
                  <p className="text-sm font-bold text-zinc-700">{formatCurrency(vehicle.precoCompra)}</p>
                </div>
                <div className="p-3 bg-accent rounded-2xl text-accent-foreground">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Venda</p>
                  <p className="text-sm font-bold">{vehicle.precoVenda ? formatCurrency(vehicle.precoVenda) : 'Sob consulta'}</p>
                </div>
              </div>

              {vehicle.precoVenda && (
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp size={16} />
                    <span className="text-sm font-black">Lucro: {formatCurrency(profit)}</span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {Math.round((profit / vehicle.precoCompra) * 100)}% margem
                  </span>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Nenhum veículo encontrado.</div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">
                {editingVehicle ? 'Editar Veículo' : 'Novo Veículo para Revenda'}
              </h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-accent rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Marca</label>
                  <input 
                    type="text" 
                    required
                    className="input-modern"
                    placeholder="Ex: Toyota"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Modelo</label>
                  <input 
                    type="text" 
                    required
                    className="input-modern"
                    placeholder="Ex: Corolla"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Ano</label>
                  <input 
                    type="number" 
                    className="input-modern"
                    placeholder="2024"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Status</label>
                  <select 
                    className="select-modern"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="available">Disponível</option>
                    <option value="reserved">Reservado</option>
                    <option value="sold">Vendido</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Preço de Compra (R$)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="input-modern"
                    placeholder="0.00"
                    value={formData.precoCompra}
                    onChange={(e) => setFormData({ ...formData, precoCompra: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Preço de Venda (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-modern font-bold"
                    placeholder="0.00"
                    value={formData.precoVenda}
                    onChange={(e) => setFormData({ ...formData, precoVenda: e.target.value })}
                  />
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
                  className="flex-1 px-6 py-4 bg-accent text-accent-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20"
                >
                  {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}
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
        title="Excluir Veículo?"
        message="Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Resale;
