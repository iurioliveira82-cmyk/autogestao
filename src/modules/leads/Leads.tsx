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
  Flame,
  MessageSquare,
  TrendingUp,
  Clock
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Lead, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { formatPhone, cn, isValidEmail, handleFirestoreError } from '../../utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';

interface LeadsProps {
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: any) => void;
}

const Leads: React.FC<LeadsProps> = ({ setActiveTab }) => {
  const { profile, isAdmin } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTemperature, setFilterTemperature] = useState<string>('all');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: '',
    status: 'novo_lead' as Lead['status'],
    temperature: 'warm' as Lead['temperature'],
    notes: ''
  });

  useEffect(() => {
    if (!profile?.empresaId) return;
    const q = query(
      collection(db, 'leads'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      setLeads(leadsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leads');
      toast.error('Erro ao carregar leads.');
    });

    return () => unsubscribe();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    if (formData.email && !isValidEmail(formData.email)) {
      toast.error('Por favor, insira um e-mail válido.');
      return;
    }

    try {
      const data = {
        ...formData,
        empresaId: profile?.empresaId,
        updatedAt: serverTimestamp()
      };

      if (editingLead) {
        await updateDoc(doc(db, 'leads', editingLead.id), data);
        toast.success('Lead atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'leads'), {
          ...data,
          createdAt: serverTimestamp()
        });
        toast.success('Lead cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingLead ? OperationType.UPDATE : OperationType.CREATE, 'leads');
      toast.error('Erro ao salvar lead.');
    }
  };

  const handleDelete = async (id: string) => {
    setLeadToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!leadToDelete) return;
    try {
      await deleteDoc(doc(db, 'leads', leadToDelete));
      toast.success('Lead excluído com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir lead.');
    } finally {
      setLeadToDelete(null);
    }
  };

  const openModal = (lead?: Lead) => {
    if (lead) {
      setEditingLead(lead);
      setFormData({
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        source: lead.source || '',
        status: lead.status,
        temperature: lead.temperature,
        notes: lead.notes || ''
      });
    } else {
      setEditingLead(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        source: '',
        status: 'novo_lead',
        temperature: 'warm',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLead(null);
  };

  const convertToClient = async (lead: Lead) => {
    try {
      // 1. Create client
      const clientData = {
        empresaId: profile?.empresaId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        status: 'active',
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'clientes'), clientData);
      
      // 2. Update lead status
      await updateDoc(doc(db, 'leads', lead.id), {
        status: 'convertido',
        updatedAt: serverTimestamp()
      });
      
      toast.success('Lead convertido em cliente com sucesso!');
      setActiveTab('clients');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}`);
      toast.error('Erro ao converter lead.');
    }
  };

  const filteredLeads = leads.filter(lead => {
    const searchLower = searchTerm.toLowerCase();
    const searchDigits = searchTerm.replace(/\D/g, '');
    const leadPhoneDigits = lead.phone.replace(/\D/g, '');
    
    const matchesSearch = lead.name.toLowerCase().includes(searchLower) ||
                         lead.email?.toLowerCase().includes(searchLower) ||
                         lead.phone.includes(searchTerm) ||
                         (searchDigits !== '' && leadPhoneDigits.includes(searchDigits));
    
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    const matchesTemperature = filterTemperature === 'all' || lead.temperature === filterTemperature;

    return matchesSearch && matchesStatus && matchesTemperature;
  });

  const getStatusColor = (status: Lead['status']) => {
    switch (status) {
      case 'novo_lead': return 'bg-blue-100 text-blue-700';
      case 'contato_realizado': return 'bg-yellow-100 text-yellow-700';
      case 'negociacao': return 'bg-green-100 text-green-700';
      case 'convertido': return 'bg-purple-100 text-purple-700';
      case 'perdido': return 'bg-red-100 text-red-700';
      default: return 'bg-zinc-100 text-zinc-700';
    }
  };

  const getTemperatureIcon = (temp: Lead['temperature']) => {
    switch (temp) {
      case 'hot': return <Flame size={14} className="text-red-500" />;
      case 'warm': return <TrendingUp size={14} className="text-orange-500" />;
      case 'cold': return <Clock size={14} className="text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input
            type="text"
            placeholder="Buscar leads por nome, email ou telefone..."
            className="input-modern pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-zinc-200 dark:shadow-none text-sm font-bold"
          >
            <UserPlus size={18} />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <Filter size={16} className="text-zinc-400" />
          <select
            className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos os Status</option>
            <option value="novo_lead">Novo</option>
            <option value="contato_realizado">Contatado</option>
            <option value="negociacao">Qualificado</option>
            <option value="convertido">Convertido</option>
            <option value="perdido">Perdido</option>
          </select>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <Flame size={16} className="text-zinc-400" />
          <select
            className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
            value={filterTemperature}
            onChange={(e) => setFilterTemperature(e.target.value)}
          >
            <option value="all">Todas as Temperaturas</option>
            <option value="hot">Quente</option>
            <option value="warm">Morno</option>
            <option value="cold">Frio</option>
          </select>
        </div>
      </div>

      {/* Leads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-none transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openModal(lead)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(lead.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 shrink-0">
                <UserPlus size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate pr-12">{lead.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", getStatusColor(lead.status))}>
                    {lead.status}
                  </span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                    {getTemperatureIcon(lead.temperature)}
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      {lead.temperature}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <Phone size={16} className="shrink-0" />
                <span className="font-medium">{lead.phone}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-3 text-sm text-zinc-500">
                  <Mail size={16} className="shrink-0" />
                  <span className="font-medium truncate">{lead.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <TrendingUp size={16} className="shrink-0" />
                <span className="font-medium">Origem: {lead.source || 'Não informada'}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <Calendar size={12} />
                {lead.createdAt ? format(new Date(lead.createdAt), 'dd/MM/yyyy') : 'Recente'}
              </div>
              <button
                onClick={() => openModal(lead)}
                className="text-xs font-bold text-accent dark:text-white flex items-center gap-1 hover:gap-2 transition-all"
              >
                Detalhes
                <ChevronRight size={14} />
              </button>
            </div>
            
            {lead.status !== 'convertido' && (
              <button
                onClick={() => convertToClient(lead)}
                className="mt-4 w-full py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/40 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} />
                Converter em Cliente
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                  {editingLead ? 'Editar Lead' : 'Novo Lead'}
                </h2>
                <p className="text-zinc-500 text-sm font-medium mt-1">Preencha as informações do lead</p>
              </div>
              <button onClick={closeModal} className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl text-zinc-400 transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Nome Completo</label>
                  <input
                    required
                    className="input-modern"
                    placeholder="Ex: João Silva"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Telefone</label>
                    <input
                      required
                      className="input-modern"
                      placeholder="(00) 00000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Email</label>
                    <input
                      type="email"
                      className="input-modern"
                      placeholder="email@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Status</label>
                    <select
                      className="select-modern"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Lead['status'] })}
                    >
                      <option value="novo_lead">Novo</option>
                      <option value="contato_realizado">Contatado</option>
                      <option value="negociacao">Qualificado</option>
                      <option value="convertido">Convertido</option>
                      <option value="perdido">Perdido</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Temperatura</label>
                    <select
                      className="select-modern"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value as Lead['temperature'] })}
                    >
                      <option value="cold">Frio</option>
                      <option value="warm">Morno</option>
                      <option value="hot">Quente</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Origem</label>
                  <input
                    className="input-modern"
                    placeholder="Ex: Instagram, Indicação, Site"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Observações</label>
                  <textarea
                    className="textarea-modern min-h-[100px]"
                    placeholder="Detalhes sobre o lead..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-8 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-8 py-4 bg-accent text-accent-foreground rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-zinc-200 dark:shadow-none text-sm font-bold"
                >
                  {editingLead ? 'Salvar Alterações' : 'Cadastrar Lead'}
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
        title="Excluir Lead"
        message="Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Leads;
