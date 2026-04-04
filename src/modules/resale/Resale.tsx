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
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AppDialog } from '../../components/ui/AppDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';

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
      setIsDeleteModalOpen(false);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <StatusBadge label="Disponível" variant="success" icon={<CheckCircle2 size={12} />} />;
      case 'reserved': return <StatusBadge label="Reservado" variant="warning" icon={<Clock size={12} />} />;
      case 'sold': return <StatusBadge label="Vendido" variant="neutral" icon={<ShoppingBag size={12} />} />;
      default: return <StatusBadge label={status} variant="neutral" />;
    }
  };

  return (
    <PageContainer>
      <PageHeader 
        title="Revenda de Veículos"
        subtitle="Gestão de estoque de veículos para compra e venda."
        breadcrumbs={[{ label: 'AutoGestão' }, { label: 'Revenda' }]}
        actions={
          canCreate && (
            <AppButton onClick={() => openModal()} icon={<Plus size={18} />}>
              Novo Veículo
            </AppButton>
          )
        }
      />

      <div className="space-y-6">
        {/* Search */}
        <div className="relative max-w-xl">
          <AppInput 
            placeholder="Buscar por marca ou modelo..." 
            icon={<Search size={18} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Resale Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center text-slate-400 italic">Carregando veículos...</div>
          ) : filteredVehicles.length > 0 ? filteredVehicles.map((vehicle) => {
            const profit = vehicle.precoVenda ? vehicle.precoVenda - vehicle.precoCompra : 0;
            
            return (
              <SectionCard key={vehicle.id} className="group hover:scale-[1.02] transition-all duration-300">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 shadow-sm border border-slate-200">
                      <Car size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 font-display">{vehicle.brand} {vehicle.model}</h3>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Tag size={12} />
                        {vehicle.year || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {canEdit && (
                      <AppButton 
                        variant="ghost"
                        size="sm"
                        onClick={() => openModal(vehicle)}
                        className="w-8 h-8 !p-0"
                      >
                        <Edit2 size={16} />
                      </AppButton>
                    )}
                    {canDelete && (
                      <AppButton 
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(vehicle.id)}
                        className="w-8 h-8 !p-0 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </AppButton>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  {getStatusBadge(vehicle.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Compra</p>
                    <p className="text-sm font-black text-slate-700">{formatCurrency(vehicle.precoCompra)}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Venda</p>
                    <p className="text-sm font-black text-primary">{vehicle.precoVenda ? formatCurrency(vehicle.precoVenda) : 'Sob consulta'}</p>
                  </div>
                </div>

                {vehicle.precoVenda && (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <TrendingUp size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Lucro: {formatCurrency(profit)}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {Math.round((profit / vehicle.precoCompra) * 100)}% margem
                    </span>
                  </div>
                )}
              </SectionCard>
            );
          }) : (
            <div className="col-span-full py-20 text-center text-slate-400 italic">Nenhum veículo encontrado.</div>
          )}
        </div>
      </div>

      {/* Modal Form */}
      <AppDialog
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingVehicle ? 'Editar Veículo' : 'Novo Veículo para Revenda'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Marca"
              required
              placeholder="Ex: Toyota"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
            <AppInput 
              label="Modelo"
              required
              placeholder="Ex: Corolla"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Ano"
              type="number"
              placeholder="2024"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
            />
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
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
            <AppInput 
              label="Preço de Compra (R$)"
              type="number"
              required
              step="0.01"
              placeholder="0.00"
              value={formData.precoCompra}
              onChange={(e) => setFormData({ ...formData, precoCompra: e.target.value })}
            />
            <AppInput 
              label="Preço de Venda (R$)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.precoVenda}
              onChange={(e) => setFormData({ ...formData, precoVenda: e.target.value })}
            />
          </div>

          <div className="pt-4 flex items-center gap-4">
            <AppButton 
              type="button"
              variant="secondary"
              onClick={closeModal}
              className="flex-1"
            >
              Cancelar
            </AppButton>
            <AppButton 
              type="submit"
              className="flex-1"
            >
              {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}
            </AppButton>
          </div>
        </form>
      </AppDialog>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Veículo?"
        message="Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita."
      />
    </PageContainer>
  );
};

export default Resale;
