import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Car, 
  Edit2, 
  Trash2, 
  ClipboardList,
  Search
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Vehicle, Client, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { formatPlate, handleFirestoreError } from '../../utils';
import { toast } from 'sonner';

// Layout Components
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';
import { DataTable } from '../../components/ui/DataTable';

// UI Components
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { AppDialog } from '../../components/ui/AppDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface VehiclesProps {
  setActiveTab?: (tab: string, itemId?: string) => void;
}

const Vehicles: React.FC<VehiclesProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const { canCreate, canEdit, canDelete } = usePermissions('vehicles');

  // Form state
  const [formData, setFormData] = useState({
    plate: '',
    brand: '',
    model: '',
    year: '',
    color: '',
    km: '',
    clienteId: ''
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const qVehicles = query(
      collection(db, 'veiculos'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('plate', 'asc')
    );
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      const vehicleList: Vehicle[] = [];
      snapshot.forEach((doc) => {
        vehicleList.push({ id: doc.id, ...doc.data() } as Vehicle);
      });
      setVehicles(vehicleList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'veiculos');
      setLoading(false);
    });

    const qClients = query(
      collection(db, 'clientes'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('name', 'asc')
    );
    const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
      const clientList: Client[] = [];
      snapshot.forEach((doc) => {
        clientList.push({ id: doc.id, ...doc.data() } as Client);
      });
      setClients(clientList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'clientes');
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeClients();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.plate || !formData.brand || !formData.model || !formData.clienteId) {
      toast.error('Placa, marca, modelo e cliente são obrigatórios.');
      return;
    }

    if (!profile) return;

    try {
      const data = {
        ...formData,
        clienteId: formData.clienteId,
        plate: formatPlate(formData.plate),
        year: formData.year ? parseInt(formData.year) : null,
        km: formData.km ? parseInt(formData.km) : null,
      };

      if (editingVehicle) {
        await updateDoc(doc(db, 'veiculos', editingVehicle.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        toast.success('Veículo atualizado com sucesso!');
      } else {
        // Check for duplicate plate
        const duplicate = vehicles.find(v => v.plate === data.plate);
        if (duplicate) {
          toast.error('Já existe um veículo cadastrado com esta placa.');
          return;
        }

        await addDoc(collection(db, 'veiculos'), {
          ...data,
          empresaId: profile.empresaId,
          createdAt: new Date().toISOString()
        });
        toast.success('Veículo cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingVehicle ? OperationType.UPDATE : OperationType.CREATE, 'veiculos');
    }
  };

  const handleDelete = async (id: string) => {
    setVehicleToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      await deleteDoc(doc(db, 'veiculos', vehicleToDelete));
      toast.success('Veículo excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `veiculos/${vehicleToDelete}`);
    } finally {
      setVehicleToDelete(null);
    }
  };

  const openModal = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year?.toString() || '',
        color: vehicle.color || '',
        km: vehicle.km?.toString() || '',
        clienteId: vehicle.clienteId
      });
    } else {
      setEditingVehicle(null);
      setFormData({
        plate: '',
        brand: '',
        model: '',
        year: '',
        color: '',
        km: '',
        clienteId: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const clientsMap = useMemo(() => {
    return clients.reduce((acc, client) => {
      acc[client.id] = client.name;
      return acc;
    }, {} as Record<string, string>);
  }, [clients]);

  const getClientName = (clienteId: string) => clientsMap[clienteId] || 'Cliente Desconhecido';

  const filteredVehicles = vehicles.filter(vehicle => {
    const search = searchTerm.toLowerCase();
    return (
      vehicle.plate.toLowerCase().includes(search) ||
      vehicle.model.toLowerCase().includes(search) ||
      vehicle.brand.toLowerCase().includes(search) ||
      getClientName(vehicle.clienteId).toLowerCase().includes(search)
    );
  });

  return (
    <PageContainer>
      <PageHeader 
        title="Veículos" 
        subtitle="Gerencie sua frota de veículos e proprietários."
        breadcrumbs={[{ label: 'Veículos' }]}
        actions={canCreate && (
          <AppButton onClick={() => openModal()} icon={<Plus size={18} />}>
            Novo Veículo
          </AppButton>
        )}
      />
      
      <SectionCard>
        <div className="mb-6">
          <AppInput 
            placeholder="Buscar por placa, modelo, marca ou proprietário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>

        <DataTable 
          columns={[
            {
              header: 'Veículo',
              accessor: (vehicle: Vehicle) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 border border-slate-200">
                    <Car size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 font-display">{vehicle.brand} {vehicle.model}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {vehicle.year} • {vehicle.color}
                    </div>
                  </div>
                </div>
              )
            },
            {
              header: 'Placa',
              accessor: (vehicle: Vehicle) => (
                <span className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black tracking-widest uppercase font-mono shadow-sm">
                  {vehicle.plate}
                </span>
              )
            },
            {
              header: 'KM Atual',
              accessor: (vehicle: Vehicle) => (
                <span className="text-xs font-bold text-slate-600">
                  {vehicle.km?.toLocaleString() || '0'} km
                </span>
              )
            },
            {
              header: 'Proprietário',
              accessor: (vehicle: Vehicle) => (
                <span className="text-xs font-bold text-slate-600">
                  {getClientName(vehicle.clienteId)}
                </span>
              )
            },
            {
              header: 'Ações',
              className: 'text-right',
              accessor: (vehicle) => (
                <div className="flex items-center justify-end gap-1">
                  {setActiveTab && (
                    <AppButton 
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab('os', vehicle.id)}
                      title="Nova OS"
                      className="h-8 w-8 p-0"
                    >
                      <ClipboardList size={14} />
                    </AppButton>
                  )}
                  {canEdit && (
                    <AppButton 
                      variant="secondary"
                      size="sm"
                      onClick={() => openModal(vehicle)}
                      title="Editar"
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 size={14} />
                    </AppButton>
                  )}
                  {canDelete && (
                    <AppButton 
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDelete(vehicle.id)}
                      title="Excluir"
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 size={14} className="text-rose-500" />
                    </AppButton>
                  )}
                </div>
              )
            }
          ]}
          data={filteredVehicles}
          isLoading={loading}
          emptyMessage="Nenhum veículo encontrado."
        />
      </SectionCard>

      {/* Modal Form */}
      <AppDialog 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        title={editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AppInput 
              label="Placa"
              required
              maxLength={7}
              placeholder="ABC1D23"
              className="font-mono font-black uppercase tracking-widest"
              value={formData.plate}
              onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente Proprietário</label>
              <select 
                required
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                value={formData.clienteId}
                onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
              >
                <option value="">Selecione um cliente...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AppInput 
              label="Marca"
              required
              placeholder="Ex: Volkswagen"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
            <AppInput 
              label="Modelo"
              required
              placeholder="Ex: Golf"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AppInput 
              label="Ano"
              type="number"
              placeholder="2024"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
            />
            <AppInput 
              label="Cor"
              placeholder="Branco"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
            <AppInput 
              label="KM Atual"
              type="number"
              placeholder="0"
              value={formData.km}
              onChange={(e) => setFormData({ ...formData, km: e.target.value })}
            />
          </div>

          <div className="pt-4 flex items-center gap-4">
            <AppButton type="button" onClick={closeModal} variant="secondary" className="flex-1">
              Cancelar
            </AppButton>
            <AppButton type="submit" className="flex-1">
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

export default Vehicles;
