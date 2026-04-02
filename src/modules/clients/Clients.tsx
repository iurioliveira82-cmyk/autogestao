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
  History,
  User
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Client, Vehicle, ServiceOrder, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { formatPhone, cn, formatCurrency, isValidEmail, handleFirestoreError } from '../../utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Layout Components
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';
import FiltersToolbar from '../../components/layout/FiltersToolbar';
import StandardTable from '../../components/layout/StandardTable';
import EmptyState from '../../components/layout/EmptyState';
import LoadingSkeleton from '../../components/layout/LoadingSkeleton';
import StandardDialog from '../../components/layout/StandardDialog';
import StandardDrawer from '../../components/layout/StandardDrawer';

// UI Components
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface ClientsProps {
  setActiveTab?: (tab: string, itemId?: string) => void;
}

const Clients: React.FC<ClientsProps> = ({ setActiveTab }) => {
  const { profile, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
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
    status: 'active' as 'active' | 'inactive',
    creditLimit: '',
    interestRate: '',
    birthDate: '',
    contactPreference: 'none' as 'email' | 'phone' | 'whatsapp' | 'none',
    purchaseHistory: ''
  });

  const [activeModalTab, setActiveModalTab] = useState<'general' | 'financial' | 'additional'>('general');

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'clientes'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientList: Client[] = [];
      snapshot.forEach((doc) => {
        clientList.push({ id: doc.id, ...doc.data() } as Client);
      });
      setClients(clientList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'clientes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!selectedClient || !profile?.empresaId) return;

    const qVehicles = query(
      collection(db, 'veiculos'),
      where('empresaId', '==', profile.empresaId),
      where('clienteId', '==', selectedClient.id)
    );
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      const list: Vehicle[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Vehicle));
      setClientVehicles(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'veiculos');
    });

    const qOrders = query(
      collection(db, 'ordens_servico'),
      where('empresaId', '==', profile.empresaId),
      where('clienteId', '==', selectedClient.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const list: ServiceOrder[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as ServiceOrder));
      setClientOrders(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'ordens_servico');
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeOrders();
    };
  }, [selectedClient, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    if (!profile) return;

    if (formData.email && !isValidEmail(formData.email)) {
      toast.error('Por favor, insira um e-mail válido.');
      return;
    }

    try {
      const data = {
        ...formData,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
        interestRate: formData.interestRate ? parseFloat(formData.interestRate) : 0,
        birthDate: formData.birthDate || null,
        contactPreference: formData.contactPreference,
        purchaseHistory: formData.purchaseHistory || ''
      };

      if (editingClient) {
        await updateDoc(doc(db, 'clientes', editingClient.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'clientes'), {
          ...data,
          empresaId: profile.empresaId,
          createdAt: serverTimestamp()
        });
        toast.success('Cliente cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingClient ? OperationType.UPDATE : OperationType.CREATE, 'clientes');
    }
  };

  const handleDelete = async (id: string) => {
    setClientToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    try {
      await deleteDoc(doc(db, 'clientes', clientToDelete));
      toast.success('Cliente excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clientes/${clientToDelete}`);
    } finally {
      setClientToDelete(null);
    }
  };

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        phone: client.phone,
        email: client.email || '',
        status: client.status,
        creditLimit: client.creditLimit?.toString() || '',
        interestRate: client.interestRate?.toString() || '',
        birthDate: client.birthDate || '',
        contactPreference: client.contactPreference || 'none',
        purchaseHistory: client.purchaseHistory || ''
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        status: 'active',
        creditLimit: '',
        interestRate: '',
        birthDate: '',
        contactPreference: 'none',
        purchaseHistory: ''
      });
    }
    setActiveModalTab('general');
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

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    const searchDigits = searchTerm.replace(/\D/g, '');
    const clientPhoneDigits = client.phone.replace(/\D/g, '');
    
    const nameMatch = client.name.toLowerCase().includes(searchLower);
    const emailMatch = client.email?.toLowerCase().includes(searchLower);
    const phoneMatch = client.phone.includes(searchTerm) || 
                      (searchDigits !== '' && clientPhoneDigits.includes(searchDigits));
    
    return nameMatch || emailMatch || phoneMatch;
  });

  return (
    <PageContainer>
      <PageHeader 
        title="Clientes" 
        subtitle="Gerencie seus clientes e histórico de atendimentos."
        breadcrumbs={[{ label: 'Clientes' }]}
        actions={
          canCreate && (
            <Button onClick={() => openModal()} variant="primary" icon={<UserPlus size={18} />}>
              Novo Cliente
            </Button>
          )
        }
      />
      
      <FiltersToolbar 
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nome, telefone ou email..."
      />

      {/* Clients Grid/List */}
      <div className="mt-6">
        {loading ? (
          <LoadingSkeleton variant="table" count={5} />
        ) : filteredClients.length > 0 ? (
          <StandardTable
            data={filteredClients}
            columns={[
              {
                header: 'Cliente',
                accessor: (client) => (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center font-bold text-base shadow-sm">
                      {client.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">{client.name}</span>
                      {client.email && <span className="text-xs text-slate-400 font-medium">{client.email}</span>}
                    </div>
                  </div>
                )
              },
              {
                header: 'Contato',
                accessor: (client) => (
                  <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                    <Phone size={14} className="text-slate-400" />
                    {formatPhone(client.phone)}
                  </div>
                )
              },
              {
                header: 'Status',
                accessor: (client) => (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                    client.status === 'active' ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"
                  )}>
                    {client.status === 'active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {client.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                )
              },
              {
                header: 'Cadastro',
                accessor: (client) => (
                  <span className="text-sm text-slate-500 font-medium">
                    {client.createdAt ? (isNaN(new Date(client.createdAt).getTime()) ? 'Recente' : format(new Date(client.createdAt), 'dd/MM/yyyy')) : 'Recente'}
                  </span>
                )
              }
            ]}
            onRowClick={(client) => openHistory(client)}
            actions={(client) => (
              <div className="flex items-center justify-end gap-1">
                {setActiveTab && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('os', client.id);
                    }}
                    className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-all"
                    title="Nova OS"
                  >
                    <ClipboardList size={18} />
                  </button>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openHistory(client);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
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
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                    title="Editar"
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
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            )}
          />
        ) : (
          <EmptyState
            icon={User}
            title="Nenhum cliente encontrado"
            description={searchTerm ? "Tente ajustar sua busca para encontrar o que procura." : "Comece cadastrando seu primeiro cliente para gerenciar seus atendimentos."}
            action={!searchTerm ? (
              <Button onClick={() => openModal()} variant="primary" icon={<UserPlus size={18} />}>
                Novo Cliente
              </Button>
            ) : undefined}
          />
        )}
      </div>

      {/* Modal Form */}
      <StandardDialog 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'} 
        maxWidth="max-w-lg"
      >
        <div className="flex items-center gap-4 mb-8">
          <button 
            type="button"
            onClick={() => setActiveModalTab('general')}
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 transition-all",
              activeModalTab === 'general' ? "border-accent text-accent" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Geral
          </button>
          <button 
            type="button"
            onClick={() => setActiveModalTab('financial')}
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 transition-all",
              activeModalTab === 'financial' ? "border-accent text-accent" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Financeiro
          </button>
          <button 
            type="button"
            onClick={() => setActiveModalTab('additional')}
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 transition-all",
              activeModalTab === 'additional' ? "border-accent text-accent" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Adicional
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeModalTab === 'general' ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  className="input-modern"
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                  <input 
                    type="tel" 
                    required
                    className="input-modern"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select 
                    className="select-modern"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email (Opcional)</label>
                <input 
                  type="email" 
                  className="input-modern"
                  placeholder="exemplo@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </>
          ) : activeModalTab === 'financial' ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Limite de Crédito Mensal (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="input-modern"
                  placeholder="Ex: 1000.00"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Taxa de Juros por Atraso (% ao mês)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="input-modern"
                  placeholder="Ex: 2.00"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Data de Aniversário</label>
                  <input 
                    type="date" 
                    className="input-modern"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pref. de Contato</label>
                  <select 
                    className="select-modern"
                    value={formData.contactPreference}
                    onChange={(e) => setFormData({ ...formData, contactPreference: e.target.value as any })}
                  >
                    <option value="none">Nenhuma</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Histórico de Compras / Notas</label>
                <textarea 
                  rows={4}
                  className="textarea-modern"
                  placeholder="Detalhes sobre compras anteriores, preferências específicas..."
                  value={formData.purchaseHistory}
                  onChange={(e) => setFormData({ ...formData, purchaseHistory: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="pt-4 flex items-center gap-4">
            <button 
              type="button"
              onClick={closeModal}
              className="flex-1 px-6 py-4 border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all text-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-6 py-4 bg-accent text-accent-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm"
            >
              {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </StandardDialog>

      {/* History Modal */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Cliente?"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
      />

      {isHistoryModalOpen && selectedClient && (
        <StandardDialog isOpen={isHistoryModalOpen} onClose={closeHistory} maxWidth="max-w-4xl" showHeader={false}>
          <div className="flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-accent text-accent-foreground">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-2xl font-black">
                  {selectedClient.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{selectedClient.name}</h3>
                  <div className="flex items-center gap-4 text-slate-400 text-sm mt-1">
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
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefone</p>
                    <a href={`tel:${selectedClient.phone}`} className="text-sm font-bold text-slate-900 hover:text-slate-600 transition-colors">
                      {formatPhone(selectedClient.phone)}
                    </a>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</p>
                    {selectedClient.email ? (
                      <a href={`mailto:${selectedClient.email}`} className="text-sm font-bold text-slate-900 hover:text-slate-600 transition-colors truncate block max-w-[150px]">
                        {selectedClient.email}
                      </a>
                    ) : (
                      <span className="text-sm font-bold text-slate-400 italic">Não informado</span>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aniversário</p>
                    <span className="text-sm font-bold text-slate-900">
                      {selectedClient.birthDate ? (isNaN(new Date(selectedClient.birthDate + 'T00:00:00').getTime()) ? 'Não informado' : format(new Date(selectedClient.birthDate + 'T00:00:00'), 'dd/MM/yyyy')) : 'Não informado'}
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pref. Contato</p>
                    <span className="text-sm font-bold text-slate-900 capitalize">
                      {(!selectedClient.contactPreference || (selectedClient.contactPreference as any) === 'none') ? 'Não informado' : selectedClient.contactPreference}
                    </span>
                  </div>
                </div>
              </section>

              {/* Purchase History Section */}
              {selectedClient.purchaseHistory && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900">
                    <History size={20} className="text-slate-400" />
                    <h4 className="text-lg font-bold uppercase tracking-widest text-sm">Histórico / Notas Adicionais</h4>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {selectedClient.purchaseHistory}
                  </div>
                </section>
              )}

              {/* Vehicles Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <Car size={20} className="text-slate-400" />
                  <h4 className="text-lg font-bold uppercase tracking-widest text-sm">Veículos Associados</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clientVehicles.length > 0 ? clientVehicles.map(vehicle => (
                    <div key={vehicle.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{vehicle.brand}</span>
                        <span className="px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded uppercase tracking-wider">{vehicle.plate}</span>
                      </div>
                      <h5 className="font-bold text-slate-900">{vehicle.model}</h5>
                      <p className="text-xs text-slate-500 mt-1">{vehicle.year} • {vehicle.color}</p>
                    </div>
                  )) : (
                    <div className="col-span-full py-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Nenhum veículo cadastrado para este cliente.
                    </div>
                  )}
                </div>
              </section>

              {/* Service History Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <ClipboardList size={20} className="text-slate-400" />
                  <h4 className="text-lg font-bold uppercase tracking-widest text-sm">Histórico de Ordens de Serviço</h4>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-200">
                        <th className="px-6 py-3">Data</th>
                        <th className="px-6 py-3">Veículo</th>
                        <th className="px-6 py-3">Serviços</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clientOrders.length > 0 ? clientOrders.map(order => {
                        const vehicle = clientVehicles.find(v => v.id === order.veiculoId);
                        return (
                          <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-500">{order.createdAt ? (isNaN(new Date(order.createdAt).getTime()) ? 'N/A' : format(new Date(order.createdAt), 'dd/MM/yy')) : 'N/A'}</td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{vehicle?.model || 'Desconhecido'}</div>
                              <div className="text-[10px] text-slate-400 uppercase">{vehicle?.plate}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {order.servicos?.map((s, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded border border-slate-200">
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                order.status === 'finalizada' ? "bg-green-50 text-green-600" :
                                order.status === 'cancelada' ? "bg-red-50 text-red-600" :
                                "bg-blue-50 text-blue-600"
                              )}>
                                {order.status === 'finalizada' ? 'Finalizada' : 
                                 order.status === 'cancelada' ? 'Cancelada' : 'Em Aberto'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900">
                              {formatCurrency(order.valorTotal)}
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                            Nenhuma ordem de serviço encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={closeHistory}
                className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </StandardDialog>
      )}
    </PageContainer>
  );
};

export default Clients;
