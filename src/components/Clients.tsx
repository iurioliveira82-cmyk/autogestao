import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  UserPlus, 
  Phone, 
  Mail, 
  Calendar, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  ChevronRight,
  Filter,
  Car,
  ClipboardList,
  History
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Client, Vehicle, ServiceOrder, OperationType } from '../types';
import { useAuth } from './Auth';
import { usePermissions } from '../hooks/usePermissions';
import { formatPhone, cn, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const Clients: React.FC = () => {
  const { profile, isAdmin } = useAuth();
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
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientVehicles, setClientVehicles] = useState<Vehicle[]>([]);
  const [clientOrders, setClientOrders] = useState<ServiceOrder[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const { canCreate, canEdit, canDelete } = usePermissions('clients');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'clients'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientList: Client[] = [];
      snapshot.forEach((doc) => {
        clientList.push({ id: doc.id, ...doc.data() } as Client);
      });
      setClients(clientList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'clients');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!selectedClient) return;

    const qVehicles = query(
      collection(db, 'vehicles'),
      where('clientId', '==', selectedClient.id)
    );
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      const list: Vehicle[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Vehicle));
      setClientVehicles(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'vehicles');
    });

    const qOrders = query(
      collection(db, 'serviceOrders'),
      where('clientId', '==', selectedClient.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const list: ServiceOrder[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ServiceOrder));
      setClientOrders(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'serviceOrders');
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeOrders();
    };
  }, [selectedClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'clients'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast.success('Cliente cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar cliente.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        await deleteDoc(doc(db, 'clients', id));
        toast.success('Cliente excluído com sucesso!');
      } catch (error) {
        console.error(error);
        toast.error('Erro ao excluir cliente.');
      }
    }
  };

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        status: client.status
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const openHistory = (client: Client) => {
    setSelectedClient(client);
    setIsHistoryModalOpen(true);
  };

  const closeHistory = () => {
    setIsHistoryModalOpen(false);
    setSelectedClient(null);
    setClientVehicles([]);
    setClientOrders([]);
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome, telefone ou email..." 
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
              <UserPlus size={20} />
              Novo Cliente
            </button>
          )}
        </div>
      </div>

      {/* Clients Grid/List */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-4">Cliente</th>
                <th className="px-8 py-4">Contato</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Cadastro</th>
                <th className="px-8 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-zinc-400 italic">Carregando clientes...</td>
                </tr>
              ) : filteredClients.length > 0 ? filteredClients.map((client) => (
                <tr key={client.id} className="group hover:bg-zinc-50 transition-colors cursor-pointer" onClick={() => openHistory(client)}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-sm">
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-zinc-900 block">{client.name}</span>
                        {client.email && <span className="text-xs text-zinc-400">{client.email}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Phone size={14} className="text-zinc-400" />
                        {formatPhone(client.phone)}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                      client.status === 'active' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {client.status === 'active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {client.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm text-zinc-500">
                    {format(new Date(client.createdAt), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openHistory(client);
                        }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                        title="Ver Histórico"
                      >
                        <History size={18} />
                      </button>
                      {canEdit && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(client);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(client.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-zinc-400 italic">Nenhum cliente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Telefone</label>
                  <input 
                    type="tel" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Email (Opcional)</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  placeholder="exemplo@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
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
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-900 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-2xl font-black">
                  {selectedClient.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{selectedClient.name}</h3>
                  <div className="flex items-center gap-4 text-zinc-400 text-sm mt-1">
                    <span className="flex items-center gap-1"><Phone size={14} /> {formatPhone(selectedClient.phone)}</span>
                    {selectedClient.email && <span className="flex items-center gap-1"><Mail size={14} /> {selectedClient.email}</span>}
                  </div>
                </div>
              </div>
              <button onClick={closeHistory} className="p-2 text-white/50 hover:text-white rounded-lg transition-colors">
                <XCircle size={28} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Contact Info Section */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400 border border-zinc-100 shadow-sm">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Telefone</p>
                    <a href={`tel:${selectedClient.phone}`} className="text-sm font-bold text-zinc-900 hover:text-zinc-600 transition-colors">
                      {formatPhone(selectedClient.phone)}
                    </a>
                  </div>
                </div>
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-zinc-400 border border-zinc-100 shadow-sm">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">E-mail</p>
                    {selectedClient.email ? (
                      <a href={`mailto:${selectedClient.email}`} className="text-sm font-bold text-zinc-900 hover:text-zinc-600 transition-colors truncate block max-w-[200px]">
                        {selectedClient.email}
                      </a>
                    ) : (
                      <span className="text-sm font-bold text-zinc-400 italic">Não informado</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Vehicles Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-900">
                  <Car size={20} className="text-zinc-400" />
                  <h4 className="text-lg font-bold uppercase tracking-widest text-sm">Veículos Associados</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clientVehicles.length > 0 ? clientVehicles.map(vehicle => (
                    <div key={vehicle.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{vehicle.brand}</span>
                        <span className="px-2 py-0.5 bg-zinc-900 text-white text-[10px] font-bold rounded uppercase tracking-wider">{vehicle.plate}</span>
                      </div>
                      <h5 className="font-bold text-zinc-900">{vehicle.model}</h5>
                      <p className="text-xs text-zinc-500 mt-1">{vehicle.year} • {vehicle.color}</p>
                    </div>
                  )) : (
                    <div className="col-span-full py-8 text-center text-zinc-400 italic bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                      Nenhum veículo cadastrado para este cliente.
                    </div>
                  )}
                </div>
              </section>

              {/* Service History Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-900">
                  <ClipboardList size={20} className="text-zinc-400" />
                  <h4 className="text-lg font-bold uppercase tracking-widest text-sm">Histórico de Ordens de Serviço</h4>
                </div>
                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-200">
                        <th className="px-6 py-3">Data</th>
                        <th className="px-6 py-3">Veículo</th>
                        <th className="px-6 py-3">Serviços</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {clientOrders.length > 0 ? clientOrders.map(order => {
                        const vehicle = clientVehicles.find(v => v.id === order.vehicleId);
                        return (
                          <tr key={order.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-6 py-4 text-zinc-500">{format(new Date(order.createdAt), 'dd/MM/yy')}</td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-zinc-900">{vehicle?.model || 'Desconhecido'}</div>
                              <div className="text-[10px] text-zinc-400 uppercase">{vehicle?.plate}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {order.services?.map((s, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 text-[10px] rounded border border-zinc-200">
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                order.status === 'finished' ? "bg-green-50 text-green-600" :
                                order.status === 'cancelled' ? "bg-red-50 text-red-600" :
                                "bg-blue-50 text-blue-600"
                              )}>
                                {order.status === 'finished' ? 'Finalizada' : 
                                 order.status === 'cancelled' ? 'Cancelada' : 'Em Aberto'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-zinc-900">
                              {formatCurrency(order.totalValue)}
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">
                            Nenhuma ordem de serviço encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button 
                onClick={closeHistory}
                className="px-8 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
