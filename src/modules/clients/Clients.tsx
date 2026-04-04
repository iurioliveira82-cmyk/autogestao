import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  Edit2, 
  Trash2, 
  Car,
  ClipboardList,
  History,
  DollarSign,
  Info
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Client, Vehicle, ServiceOrder, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { formatPhone, cn, formatCurrency, isValidEmail, handleFirestoreError, formatSafeDate } from '../../utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Layout Components
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';

// UI Components
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { AppDialog } from '../../components/ui/AppDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface ClientsProps {
  setActiveTab?: (tab: string, itemId?: string) => void;
}

const Clients: React.FC<ClientsProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
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
        title="Gestão de Clientes" 
        subtitle="Visualize, cadastre e acompanhe o histórico completo de todos os seus clientes em um só lugar."
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Clientes' }]}
        actions={
          canCreate && (
            <AppButton onClick={() => openModal()} icon={<UserPlus size={18} />} className="shadow-lg shadow-primary/20">
              Novo Cliente
            </AppButton>
          )
        }
      />
      
      <SectionCard className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 relative group">
            <AppInput 
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search size={18} className="text-slate-400 group-focus-within:text-primary transition-colors" />}
              className="bg-slate-50/50 border-slate-200/60 focus:bg-white transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200/60">
              Total: {clients.length}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard noPadding className="overflow-hidden">
        <DataTable
          columns={[
            {
              header: 'Cliente',
              accessor: (client) => (
                <div className="flex items-center gap-4 py-1">
                  <div className="w-11 h-11 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-900 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm border border-white/50 ring-1 ring-slate-200/50">
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1">{client.name}</span>
                    {client.email && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                        <Mail size={10} />
                        {client.email}
                      </div>
                    )}
                  </div>
                </div>
              )
            },
            {
              header: 'Contato',
              accessor: (client) => (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-slate-700 font-bold">
                    <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Phone size={12} />
                    </div>
                    {formatPhone(client.phone)}
                  </div>
                </div>
              )
            },
            {
              header: 'Status',
              accessor: (client) => (
                <StatusBadge 
                  status={client.status} 
                  label={client.status === 'active' ? 'Ativo' : 'Inativo'} 
                  className="font-black"
                />
              )
            },
            {
              header: 'Cadastro',
              accessor: (client) => (
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Membro desde</span>
                  <span className="text-xs text-slate-600 font-bold">
                    {formatSafeDate(client.createdAt)}
                  </span>
                </div>
              )
            },
            {
              header: 'Ações',
              className: 'text-right',
              accessor: (client) => (
                <div className="flex items-center justify-end gap-2">
                  {setActiveTab && (
                    <button 
                      onClick={() => setActiveTab('os', client.id)}
                      title="Nova OS"
                      className="h-9 w-9 flex items-center justify-center bg-slate-50 hover:bg-primary hover:text-white text-slate-400 rounded-xl transition-all border border-slate-100 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                    >
                      <ClipboardList size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => openHistory(client)}
                    title="Ver Histórico"
                    className="h-9 w-9 flex items-center justify-center bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-400 rounded-xl transition-all border border-slate-100 hover:border-slate-900 hover:shadow-lg hover:shadow-slate-900/20"
                  >
                    <History size={16} />
                  </button>
                  {canEdit && (
                    <button 
                      onClick={() => openModal(client)}
                      title="Editar"
                      className="h-9 w-9 flex items-center justify-center bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-400 rounded-xl transition-all border border-slate-100 hover:border-slate-900 hover:shadow-lg hover:shadow-slate-900/20"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(client.id)}
                      title="Excluir"
                      className="h-9 w-9 flex items-center justify-center bg-slate-50 hover:bg-rose-500 hover:text-white text-slate-400 rounded-xl transition-all border border-slate-100 hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )
            }
          ]}
          data={filteredClients}
          isLoading={loading}
          emptyMessage="Nenhum cliente encontrado."
        />
      </SectionCard>

      {/* Modal Form */}
      <AppDialog 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'} 
        maxWidth="lg"
      >
        <div className="flex items-center gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
          <button 
            type="button"
            onClick={() => setActiveModalTab('general')}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl",
              activeModalTab === 'general' ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Informações Gerais
          </button>
          <button 
            type="button"
            onClick={() => setActiveModalTab('financial')}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl",
              activeModalTab === 'financial' ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Financeiro
          </button>
          <button 
            type="button"
            onClick={() => setActiveModalTab('additional')}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl",
              activeModalTab === 'additional' ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Adicional
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {activeModalTab === 'general' ? (
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                <AppInput 
                  label="Nome Completo"
                  required
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <AppInput 
                    label="Telefone Principal"
                    required
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    className="bg-white"
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status da Conta</label>
                    <select 
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    >
                      <option value="active">Ativo (Acesso Total)</option>
                      <option value="inactive">Inativo (Bloqueado)</option>
                    </select>
                  </div>
                </div>

                <AppInput 
                  label="Endereço de E-mail"
                  type="email"
                  placeholder="exemplo@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-white"
                  icon={<Mail size={18} className="text-slate-400" />}
                />
              </div>
            </div>
          ) : activeModalTab === 'financial' ? (
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 tracking-tight">Configurações Financeiras</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Defina limites e taxas personalizadas</p>
                  </div>
                </div>

                <AppInput 
                  label="Limite de Crédito Mensal"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                  icon={<DollarSign size={18} className="text-slate-400" />}
                  className="bg-white"
                />

                <AppInput 
                  label="Taxa de Juros por Atraso (% ao mês)"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  icon={<Info size={18} className="text-slate-400" />}
                  className="bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <AppInput 
                    label="Data de Nascimento"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="bg-white"
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferência de Contato</label>
                    <select 
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                      value={formData.contactPreference}
                      onChange={(e) => setFormData({ ...formData, contactPreference: e.target.value as any })}
                    >
                      <option value="none">Não especificado</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone (Ligação)</option>
                      <option value="whatsapp">WhatsApp (Mensagem)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações Internas</label>
                  <textarea 
                    rows={4}
                    className="w-full p-4 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none placeholder:text-slate-300"
                    placeholder="Detalhes relevantes, preferências de atendimento, histórico resumido..."
                    value={formData.purchaseHistory}
                    onChange={(e) => setFormData({ ...formData, purchaseHistory: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center gap-4">
            <AppButton 
              variant="secondary"
              onClick={closeModal}
              className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]"
              type="button"
            >
              Cancelar
            </AppButton>
            <AppButton 
              type="submit"
              className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
            >
              {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </AppButton>
          </div>
        </form>
      </AppDialog>

      {/* History Modal */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Cliente?"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
      />

      <AppDialog 
        isOpen={isHistoryModalOpen} 
        onClose={closeHistory} 
        title="Histórico Detalhado"
        maxWidth="xl"
      >
        {selectedClient && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 bg-slate-900 dark:bg-black rounded-[2.5rem] text-white relative overflow-hidden group shadow-2xl">
              <div className="relative z-10 flex items-center gap-6">
                <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-inner border border-white/10 group-hover:scale-105 transition-transform duration-500">
                  {selectedClient.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-2xl font-black tracking-tight font-display">{selectedClient.name}</h3>
                    <StatusBadge 
                      status={selectedClient.status} 
                      label={selectedClient.status === 'active' ? 'Ativo' : 'Inativo'} 
                      className="bg-white/10 text-white border-white/10"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-white/50 text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><Phone size={14} className="text-primary" /> {formatPhone(selectedClient.phone)}</span>
                    {selectedClient.email && <span className="flex items-center gap-1.5"><Mail size={14} className="text-primary" /> {selectedClient.email}</span>}
                  </div>
                </div>
              </div>
              
              <div className="relative z-10 flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Total Gasto</p>
                  <p className="text-xl font-black text-primary font-display">
                    {formatCurrency(clientOrders.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0))}
                  </p>
                </div>
                <div className="h-10 w-px bg-white/10 mx-2 hidden md:block" />
                <div className="text-right">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Ordens</p>
                  <p className="text-xl font-black text-white font-display">{clientOrders.length}</p>
                </div>
              </div>

              {/* Decorative background */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-1000" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-1000" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-primary transition-colors">Telefone</p>
                <p className="text-sm font-black text-slate-900">{formatPhone(selectedClient.phone)}</p>
              </div>
              <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-primary transition-colors">E-mail</p>
                <p className="text-sm font-black text-slate-900 truncate">{selectedClient.email || 'Não informado'}</p>
              </div>
              <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-primary transition-colors">Aniversário</p>
                <p className="text-sm font-black text-slate-900">
                  {selectedClient.birthDate ? formatSafeDate(selectedClient.birthDate) : 'Não informado'}
                </p>
              </div>
              <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-primary transition-colors">Pref. Contato</p>
                <p className="text-sm font-black text-slate-900 capitalize">
                  {(!selectedClient.contactPreference || (selectedClient.contactPreference as any) === 'none') ? 'Não informado' : selectedClient.contactPreference}
                </p>
              </div>
            </div>

            {selectedClient.purchaseHistory && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-4 bg-primary rounded-full" />
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Notas e Observações</h4>
                </div>
                <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-3xl text-sm font-bold text-amber-900/70 whitespace-pre-wrap leading-relaxed italic">
                  "{selectedClient.purchaseHistory}"
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Car size={16} className="text-primary" />
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Veículos ({clientVehicles.length})</h4>
                  </div>
                </div>
                <div className="space-y-3">
                  {clientVehicles.length > 0 ? clientVehicles.map(vehicle => (
                    <div key={vehicle.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between hover:shadow-lg hover:shadow-slate-200/50 transition-all group">
                      <div>
                        <h5 className="text-xs font-black text-slate-900 group-hover:text-primary transition-colors">{vehicle.model}</h5>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{vehicle.brand} • {vehicle.year}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-sm">
                        {vehicle.plate}
                      </span>
                    </div>
                  )) : (
                    <div className="py-12 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      Nenhum veículo
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-primary" />
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Histórico de OS</h4>
                  </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Veículo</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clientOrders.length > 0 ? clientOrders.map(order => {
                        const vehicle = clientVehicles.find(v => v.id === order.veiculoId);
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 font-bold text-slate-500">{formatSafeDate(order.createdAt, 'dd/MM/yy')}</td>
                            <td className="px-6 py-4">
                              <div className="font-black text-slate-900 group-hover:text-primary transition-colors">{vehicle?.model || 'Desconhecido'}</div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{vehicle?.plate}</div>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge 
                                status={order.status === 'finalizada' ? 'paid' : order.status === 'cancelada' ? 'cancelled' : 'pending'} 
                                label={order.status === 'finalizada' ? 'Finalizada' : order.status === 'cancelada' ? 'Cancelada' : 'Aberta'}
                                className="scale-90 origin-left"
                              />
                            </td>
                            <td className="px-6 py-4 text-right font-black text-slate-900">
                              {formatCurrency(order.valorTotal)}
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                            Nenhuma ordem de serviço encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <AppButton variant="secondary" onClick={closeHistory} className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px]">
                Fechar Histórico
              </AppButton>
            </div>
          </div>
        )}
      </AppDialog>
    </PageContainer>
  );
};

export default Clients;
