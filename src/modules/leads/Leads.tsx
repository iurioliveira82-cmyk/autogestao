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
import { formatPhone, cn, isValidEmail, handleFirestoreError, formatSafeDate } from '../../utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';

import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AppDialog } from '../../components/ui/AppDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import FiltersToolbar from '../../components/layout/FiltersToolbar';
import SectionCard from '../../components/layout/SectionCard';
import EmptyState from '../../components/layout/EmptyState';

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
      setIsDeleteModalOpen(false);
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

  const getStatusBadge = (status: Lead['status']) => {
    switch (status) {
      case 'novo_lead': return <StatusBadge label="Novo" variant="info" />;
      case 'contato_realizado': return <StatusBadge label="Contatado" variant="warning" />;
      case 'negociacao': return <StatusBadge label="Qualificado" variant="success" />;
      case 'convertido': return <StatusBadge label="Convertido" variant="success" />;
      case 'perdido': return <StatusBadge label="Perdido" variant="danger" />;
      default: return <StatusBadge label={status.replace('_', ' ')} variant="neutral" />;
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
    <PageContainer>
      <PageHeader 
        title="CRM / Leads"
        subtitle="Gerencie suas oportunidades de negócio e conversões."
        breadcrumbs={[{ label: 'AutoGestão' }, { label: 'Leads' }]}
        actions={
          <AppButton
            onClick={() => openModal()}
            icon={<Plus size={18} />}
          >
            Novo Lead
          </AppButton>
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
          <SectionCard className="!p-0 overflow-hidden">
            <DataTable 
              data={filteredLeads}
              headers={['Lead', 'Status', 'Contato', 'Origem', 'Data', 'Ações']}
              renderRow={(lead) => (
                <>
                  <td className="px-6 py-4">
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
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(lead.status)}
                  </td>
                  <td className="px-6 py-4">
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
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {lead.source || 'Não informada'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <Calendar size={12} />
                      {formatSafeDate(lead.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {lead.status !== 'convertido' && (
                        <AppButton
                          variant="ghost"
                          size="sm"
                          onClick={() => convertToClient(lead)}
                          className="w-8 h-8 !p-0 text-green-600 hover:bg-green-50"
                          title="Converter em Cliente"
                        >
                          <CheckCircle2 size={18} />
                        </AppButton>
                      )}
                      <AppButton
                        variant="ghost"
                        size="sm"
                        onClick={() => openModal(lead)}
                        className="w-8 h-8 !p-0"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </AppButton>
                      <AppButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(lead.id)}
                        className="w-8 h-8 !p-0 text-red-600 hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </AppButton>
                    </div>
                  </td>
                </>
              )}
            />
          </SectionCard>
        ) : (
          <EmptyState 
            icon={UserPlus}
            title="Nenhum lead encontrado"
            description={searchTerm ? "Não encontramos leads para sua busca." : "Comece cadastrando seu primeiro lead."}
            action={!searchTerm ? (
              <AppButton onClick={() => openModal()} icon={<Plus size={18} />}>
                Cadastrar Lead
              </AppButton>
            ) : undefined}
          />
        )}
      </div>

      <AppDialog
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingLead ? 'Editar Lead' : 'Novo Lead'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <AppInput
              label="Nome Completo"
              required
              placeholder="Ex: João Silva"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AppInput
                label="Telefone"
                required
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
              />
              <AppInput
                label="Email"
                type="email"
                placeholder="email@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value as Lead['temperature'] })}
                >
                  <option value="cold">Frio</option>
                  <option value="warm">Morno</option>
                  <option value="hot">Quente</option>
                </select>
              </div>
            </div>

            <AppInput
              label="Origem"
              placeholder="Ex: Instagram, Indicação, Site"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            />

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Observações</label>
              <textarea
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm min-h-[100px]"
                placeholder="Detalhes sobre o lead..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
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
              {editingLead ? 'Salvar Alterações' : 'Cadastrar Lead'}
            </AppButton>
          </div>
        </form>
      </AppDialog>

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
