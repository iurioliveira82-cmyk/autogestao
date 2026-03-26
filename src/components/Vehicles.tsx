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
  User
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Vehicle, Client } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { formatPlate, cn } from '../lib/utils';
import { toast } from 'sonner';

const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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
    clientId: ''
  });

  useEffect(() => {
    const qVehicles = query(collection(db, 'vehicles'), orderBy('plate', 'asc'));
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      const vehicleList: Vehicle[] = [];
      snapshot.forEach((doc) => {
        vehicleList.push({ id: doc.id, ...doc.data() } as Vehicle);
      });
      setVehicles(vehicleList);
      setLoading(false);
    });

    const qClients = query(collection(db, 'clients'), orderBy('name', 'asc'));
    const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
      const clientList: Client[] = [];
      snapshot.forEach((doc) => {
        clientList.push({ id: doc.id, ...doc.data() } as Client);
      });
      setClients(clientList);
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeClients();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.plate || !formData.brand || !formData.model || !formData.clientId) {
      toast.error('Placa, marca, modelo e cliente são obrigatórios.');
      return;
    }

    try {
      const data = {
        ...formData,
        plate: formatPlate(formData.plate),
        year: formData.year ? parseInt(formData.year) : null,
        km: formData.km ? parseInt(formData.km) : null,
      };

      if (editingVehicle) {
        await updateDoc(doc(db, 'vehicles', editingVehicle.id), {
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

        await addDoc(collection(db, 'vehicles'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        toast.success('Veículo cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar veículo.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este veículo?')) {
      try {
        await deleteDoc(doc(db, 'vehicles', id));
        toast.success('Veículo excluído com sucesso!');
      } catch (error) {
        console.error(error);
        toast.error('Erro ao excluir veículo.');
      }
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
        clientId: vehicle.clientId
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
        clientId: ''
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

  const getClientName = (clientId: string) => clientsMap[clientId] || 'Cliente Desconhecido';

  const filteredVehicles = vehicles.filter(vehicle => {
    const search = searchTerm.toLowerCase();
    return (
      vehicle.plate.toLowerCase().includes(search) ||
      vehicle.model.toLowerCase().includes(search) ||
      vehicle.brand.toLowerCase().includes(search) ||
      getClientName(vehicle.clientId).toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por placa, modelo, marca ou proprietário..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="p-3 bg-white border border-zinc-200 rounded-2xl text-zinc-500 hover:bg-zinc-50 transition-colors">
            <Filter size={20} />
          </button>
          {canCreate && (
            <button 
              onClick={() => openModal()}
              className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
            >
              <Plus size={20} />
              Novo Veículo
            </button>
          )}
        </div>
      </div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Carregando veículos...</div>
        ) : filteredVehicles.length > 0 ? filteredVehicles.map((vehicle) => (
          <div key={vehicle.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-900 shadow-sm border border-zinc-200">
                  <Car size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">{vehicle.brand} {vehicle.model}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    <Hash size={12} />
                    {vehicle.plate}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button 
                    onClick={() => openModal(vehicle)}
                    className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
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

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Ano</p>
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <Calendar size={14} className="text-zinc-400" />
                  {vehicle.year || 'N/A'}
                </div>
              </div>
              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">KM</p>
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <Gauge size={14} className="text-zinc-400" />
                  {vehicle.km?.toLocaleString() || 'N/A'}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {getClientName(vehicle.clientId).slice(0, 1).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-zinc-600">{getClientName(vehicle.clientId)}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <Palette size={12} />
                {vehicle.color || 'N/A'}
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Nenhum veículo encontrado.</div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">
                {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
              </h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Placa</label>
                  <input 
                    type="text" 
                    required
                    maxLength={7}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-mono uppercase"
                    placeholder="ABC1D23"
                    value={formData.plate}
                    onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Cliente Proprietário</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
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
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Marca</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="Ex: Volkswagen"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Modelo</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="Ex: Golf"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Ano</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="2024"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Cor</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="Branco"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">KM Atual</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
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
                  className="flex-1 px-6 py-4 border border-zinc-200 text-zinc-600 font-bold rounded-2xl hover:bg-zinc-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                >
                  {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
