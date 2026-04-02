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

import { Button } from '../../components/ui/Button';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import FiltersToolbar from '../../components/layout/FiltersToolbar';
import StandardTable from '../../components/layout/StandardTable';
import EmptyState from '../../components/layout/EmptyState';
import StandardDialog from '../../components/layout/StandardDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface LeadsProps {
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: any) => void;
}

const Leads: React.FC<LeadsProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
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
      const clientData = {
        empresaId: profile?.empresaId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        status: 'active',
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'clientes'), clientData);
      
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
      case 'novo_lead': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'contato_realizado': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'negociacao': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'convertido': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'perdido': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const getTemperatureIcon = (temp: Lead['temperature']) => {
    switch (temp) {
      case 'hot': return <Flame size={14} className="text-red-500" />;
      case 'warm': return <TrendingUp size={14} className="text-orange-500" />;
      case 'cold': return <Clock size={14} className="text-blue-500" />;
    }
  };

  const columns = [
    {
      header: 'Lead',
      accessor: (lead: Lead) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400">
            <UserPlus size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-white">{lead.name}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {getTemperatureIcon(lead.temperature)}
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {lead.temperature}
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: (lead: Lead) => (
        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full", getStatusColor(lead.status))}>
          {lead.status.replace('_', ' ')}
        </span>
      )
    },
    {
      header: 'Contato',
      accessor: (lead: Lead) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Phone size={14} className="text-slate-400" />
            {lead.phone}
          </div>
          {lead.email && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Mail size={14} className="text-slate-400" />
              {lead.email}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Origem',
      accessor: (lead: Lead) => (
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {lead.source || 'Não informada'}
        </span>
      )
    },
    {
      header: 'Data',
      accessor: (lead: Lead) => (
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <Calendar size={12} />
          {lead.createdAt ? format(new Date(lead.createdAt), 'dd/MM/yyyy') : 'Recente'}
        </div>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader 
        title="CRM / Leads"
        subtitle="Gerencie suas oportunidades de negócio e conversões."
        breadcrumbs={[{ label: 'AutoGestão' }, { label: 'Leads' }]}
        actions={
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm font-bold"
          >
            <Plus size={18} />
            Novo Lead
          </button>
        }
      />

      <div className="space-y-6">
        <FiltersToolbar 
          searchQuery={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar leads..."
          filters={
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none cursor-pointer"
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
              <select
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none cursor-pointer"
                value={filterTemperature}
                onChange={(e) => setFilterTemperature(e.target.value)}
              >
                <option value="all">Todas as Temperaturas</option>
                <option value="hot">Quente</option>
                <option value="warm">Morno</option>
                <option value="cold">Frio</option>
              </select>
            </div>
          }
        />

        {filteredLeads.length > 0 ? (
          <StandardTable 
            data={filteredLeads}
            columns={columns}
            actions={(lead) => (
              <div className="flex items-center gap-2">
                {lead.status !== 'convertido' && (
                  <button
                    onClick={() => convertToClient(lead)}
                    className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl text-green-600 transition-colors"
                    title="Converter em Cliente"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                )}
                <button
                  onClick={() => openModal(lead)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 transition-colors"
                  title="Editar"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(lead.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-600 transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          />
        ) : (
          <EmptyState 
            icon={UserPlus}
            title="Nenhum lead encontrado"
            description={searchTerm ? "Não encontramos leads para sua busca." : "Comece cadastrando seu primeiro lead."}
            action={!searchTerm ? (
              <Button onClick={() => openModal()} variant="primary" icon={<Plus size={18} />}>
                Cadastrar Lead
              </Button>
            ) : undefined}
          />
        )}
      </div>

      <StandardDialog
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingLead ? 'Editar Lead' : 'Novo Lead'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Nome Completo</label>
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
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Telefone</label>
                <input
                  required
                  className="input-modern"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
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
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
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
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Temperatura</label>
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
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Origem</label>
              <input
                className="input-modern"
                placeholder="Ex: Instagram, Indicação, Site"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Observações</label>
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
              className="flex-1 px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-8 py-4 bg-accent text-accent-foreground rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm font-bold"
            >
              {editingLead ? 'Salvar Alterações' : 'Cadastrar Lead'}
            </button>
          </div>
        </form>
      </StandardDialog>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Lead"
        message="Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita."
      />
    </PageContainer>
  );
};

export default Leads;
