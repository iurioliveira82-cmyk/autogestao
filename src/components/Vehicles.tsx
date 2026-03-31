import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Car, 
  Hash, 
  Palette, 
  Calendar, 
  Gauge, 
  Edit2, 
  Trash2, 
  XCircle,
  Filter,
  User,
  ClipboardList
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Vehicle, Client, OperationType } from '../types';
import { useAuth } from './Auth';
import { usePermissions } from '../hooks/usePermissions';
import { formatPlate, cn, handleFirestoreError } from '../lib/utils';
import { toast } from 'sonner';
import { ConfirmationModal } from './ConfirmationModal';

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
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-3xl">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por placa, modelo, marca ou proprietário..." 
            className="w-full pl-12 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button className="flex items-center justify-center p-3 bg-white border border-zinc-200 rounded-2xl text-zinc-500 hover:bg-zinc-50 transition-colors shadow-sm w-full sm:w-auto">
            <Filter size={20} />
            <span className="sm:hidden ml-2 font-bold text-sm">Filtros</span>
          </button>
          {canCreate && (
            <button 
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm w-full sm:w-auto"
            >
              <Plus size={20} />
              Novo Veículo
            </button>
          )}
        </div>
      </div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-400 text-sm italic">Carregando veículos...</p>
            </div>
          </div>
        ) : filteredVehicles.length > 0 ? filteredVehicles.map((vehicle) => (
          <div 
            key={vehicle.id} 
            className="bg-white rounded-[2rem] border border-zinc-200 p-6 hover:shadow-xl hover:shadow-zinc-100 transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Car size={28} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 line-clamp-1">{vehicle.brand} {vehicle.model}</h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{vehicle.year} • {vehicle.color}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {setActiveTab && (
                  <button 
                    onClick={() => setActiveTab('os', vehicle.id)}
                    className="p-2 text-accent hover:bg-accent/10 rounded-xl transition-all"
                    title="Nova OS"
                  >
                    <ClipboardList size={16} />
                  </button>
                )}
                {canEdit && (
                  <button 
                    onClick={() => openModal(vehicle)}
                    className="p-2 text-zinc-400 hover:text-accent hover:bg-zinc-100 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(vehicle.id)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-zinc-50 rounded-2xl p-4 mb-6 border border-zinc-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Placa</span>
                <span className="px-3 py-1 bg-accent text-accent-foreground rounded-lg text-xs font-black tracking-wider uppercase">{vehicle.plate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">KM Atual</span>
                <span className="text-sm font-black text-zinc-900">{vehicle.km?.toLocaleString() || '0'} km</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-zinc-100">
              <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                <User size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Proprietário</span>
                <span className="text-xs font-bold text-zinc-600 truncate max-w-[150px]">
                  {getClientName(vehicle.clienteId)}
                </span>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-2 opacity-40">
              <Car size={48} className="text-zinc-300" />
              <p className="text-zinc-500 text-sm font-medium">Nenhum veículo encontrado.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-xl font-black text-zinc-900">
                  {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
                </h3>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Informações Técnicas</p>
              </div>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-accent rounded-xl hover:bg-zinc-100 transition-all">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Placa</label>
                  <input 
                    type="text" 
                    required
                    maxLength={7}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all font-mono font-black uppercase tracking-widest text-sm"
                    placeholder="ABC1D23"
                    value={formData.plate}
                    onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cliente Proprietário</label>
                  <select 
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-bold"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Marca</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="Ex: Volkswagen"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Modelo</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="Ex: Golf"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Ano</label>
                  <input 
                    type="number" 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="2024"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cor</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="Branco"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">KM Atual</label>
                  <input 
                    type="number" 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    placeholder="0"
                    value={formData.km}
                    onChange={(e) => setFormData({ ...formData, km: e.target.value })}
                  />
                </div>
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

export default Vehicles;
