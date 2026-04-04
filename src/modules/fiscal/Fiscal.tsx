import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Download, 
  Filter, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ExternalLink,
  Trash2,
  Edit2,
  TrendingUp
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { FiscalRecord, OperationType, Client } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency, cn, handleFirestoreError, formatSafeDate } from '../../utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AppDialog } from '../../components/ui/AppDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';

interface FiscalProps {
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: any) => void;
}

const Fiscal: React.FC<FiscalProps> = ({ setActiveTab }) => {
  const { profile, isAdmin } = useAuth();

  const [records, setRecords] = useState<FiscalRecord[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [serviceOrders, setServiceOrders] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FiscalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const { canView, canCreate, canEdit, canDelete } = usePermissions('fiscal');

  const [formData, setFormData] = useState({
    type: 'nfse' as 'nfe' | 'nfse' | 'cupom',
    number: '',
    serie: '',
    date: formatSafeDate(new Date(), 'yyyy-MM-dd'),
    value: '',
    valorImposto: '',
    status: 'emitida' as 'emitida' | 'cancelada' | 'pendente',
    clienteId: '',
    fornecedorId: '',
    direction: 'out' as 'in' | 'out',
    relatedId: '',
    observacoes: '',
    createTransaction: false,
    dueDate: formatSafeDate(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (!profile?.empresaId || !canView) return;

    // Fetch Fiscal Records
    const q = query(
      collection(db, 'registros_fiscais'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: FiscalRecord[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as FiscalRecord);
      });
      setRecords(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'registros_fiscais');
      setLoading(false);
    });

      // Fetch Clients for mapping
      const qClients = query(
        collection(db, 'clientes'),
        where('empresaId', '==', profile.empresaId)
      );
      const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
        const map: Record<string, string> = {};
        snapshot.forEach(doc => {
          map[doc.id] = doc.data().name;
        });
        setClients(map);
      });
  
      // Fetch Suppliers for mapping
      const qSuppliers = query(
        collection(db, 'fornecedores'),
        where('empresaId', '==', profile.empresaId)
      );
      const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
        const map: Record<string, string> = {};
        snapshot.forEach(doc => {
          map[doc.id] = doc.data().name;
        });
        setSuppliers(map);
      });

    // Fetch Service Orders for mapping
    const qOS = query(
      collection(db, 'ordens_servico'),
      where('empresaId', '==', profile.empresaId)
    );
    const unsubscribeOS = onSnapshot(qOS, (snapshot) => {
      const map: Record<string, string> = {};
      snapshot.forEach(doc => {
        map[doc.id] = `OS #${doc.data().number}`;
      });
      setServiceOrders(map);
    });

    return () => {
      unsubscribe();
      unsubscribeClients();
      unsubscribeSuppliers();
      unsubscribeOS();
    };
  }, [profile, canView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.number || !formData.value || (formData.direction === 'out' && !formData.clienteId) || (formData.direction === 'in' && !formData.fornecedorId)) {
      toast.error('Número, valor e cliente/fornecedor são obrigatórios.');
      return;
    }

    try {
      const val = parseFloat(formData.value);
      const data = {
        empresaId: profile?.empresaId,
        type: formData.type,
        number: formData.number,
        serie: formData.serie,
        date: new Date(formData.date).toISOString(),
        value: val,
        valorImposto: formData.valorImposto ? parseFloat(formData.valorImposto) : 0,
        status: formData.status,
        clienteId: formData.direction === 'out' ? formData.clienteId : null,
        fornecedorId: formData.direction === 'in' ? formData.fornecedorId : null,
        direction: formData.direction,
        relatedId: formData.relatedId || null,
        observacoes: formData.observacoes,
        updatedAt: serverTimestamp()
      };

      if (editingRecord) {
        await updateDoc(doc(db, 'registros_fiscais', editingRecord.id), data);
        toast.success('Registro fiscal atualizado!');
      } else {
        const newDoc = await addDoc(collection(db, 'registros_fiscais'), {
          ...data,
          createdAt: new Date().toISOString()
        });

        // Create financial transaction if requested
        if (formData.createTransaction) {
          const isEntry = formData.direction === 'in';
          const entityName = isEntry ? suppliers[formData.fornecedorId] : clients[formData.clienteId];
          
          await addDoc(collection(db, 'transacoes_financeiras'), {
            empresaId: profile?.empresaId,
            type: isEntry ? 'out' : 'in',
            value: val,
            category: 'Fiscal',
            description: `Nota Fiscal ${formData.type.toUpperCase()} #${formData.number} - ${entityName}`,
            date: new Date(formData.dueDate).toISOString(),
            status: 'pending',
            paymentMethod: 'Boleto',
            fornecedorId: isEntry ? formData.fornecedorId : undefined,
            clienteId: !isEntry ? formData.clienteId : undefined,
            relatedId: formData.relatedId || undefined,
            createdAt: new Date().toISOString()
          });
        }

        toast.success('Nota fiscal registrada!');
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'registros_fiscais');
    }
  };

  const handleDelete = async (id: string) => {
    setRecordToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'registros_fiscais', recordToDelete));
      toast.success('Registro excluído!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `registros_fiscais/${recordToDelete}`);
    } finally {
      setRecordToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  const openModal = (record?: FiscalRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        type: record.type,
        number: record.number,
        serie: record.serie || '',
        date: formatSafeDate(record.date, 'yyyy-MM-dd'),
        value: record.value.toString(),
        valorImposto: record.valorImposto?.toString() || '',
        status: record.status as any,
        clienteId: record.clienteId || '',
        fornecedorId: record.fornecedorId || '',
        direction: record.direction || 'out',
        relatedId: record.relatedId || '',
        observacoes: record.observacoes || '',
        createTransaction: false,
        dueDate: formatSafeDate(new Date(), 'yyyy-MM-dd')
      });
    } else {
      setEditingRecord(null);
      setFormData({
        type: 'nfse',
        number: '',
        serie: '',
        date: formatSafeDate(new Date(), 'yyyy-MM-dd'),
        value: '',
        valorImposto: '',
        status: 'emitida',
        clienteId: '',
        fornecedorId: '',
        direction: 'out',
        relatedId: '',
        observacoes: '',
        createTransaction: false,
        dueDate: formatSafeDate(new Date(), 'yyyy-MM-dd')
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const filteredRecords = records.filter(r => 
    r.number.includes(searchTerm) ||
    (r.clienteId && clients[r.clienteId]?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.fornecedorId && suppliers[r.fornecedorId]?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalValue = filteredRecords.reduce((acc, curr) => acc + curr.value, 0);
  const totalTax = filteredRecords.reduce((acc, curr) => acc + (curr.valorImposto || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'emitida': return <StatusBadge label="Emitida" variant="success" />;
      case 'cancelada': return <StatusBadge label="Cancelada" variant="danger" />;
      case 'pendente': return <StatusBadge label="Pendente" variant="warning" />;
      default: return <StatusBadge label={status} variant="neutral" />;
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <XCircle size={48} className="mb-4" />
          <p className="text-lg font-medium">Acesso restrito.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader 
        title="Gestão Fiscal"
        subtitle="Controle de notas fiscais emitidas e recebidas."
        breadcrumbs={[{ label: 'AutoGestão' }, { label: 'Fiscal' }]}
        actions={
          <div className="flex items-center gap-3">
            <AppButton variant="outline" icon={<Download size={18} />}>
              Exportar
            </AppButton>
            {canCreate && (
              <AppButton onClick={() => openModal()} icon={<Plus size={18} />}>
                Emitir Nota
              </AppButton>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SectionCard className="group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <FileText size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Notas</span>
            </div>
            <h3 className="text-3xl font-black text-slate-900 font-display">{filteredRecords.length}</h3>
          </SectionCard>
          <SectionCard className="group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total</span>
            </div>
            <h3 className="text-3xl font-black text-slate-900 font-display">{formatCurrency(totalValue)}</h3>
          </SectionCard>
          <SectionCard className="group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Impostos</span>
            </div>
            <h3 className="text-3xl font-black text-slate-900 font-display">{formatCurrency(totalTax)}</h3>
          </SectionCard>
        </div>

        {/* Search */}
        <div className="relative max-w-xl">
          <AppInput 
            placeholder="Buscar por número ou cliente..." 
            icon={<Search size={18} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Records Table */}
        <SectionCard className="!p-0 overflow-hidden">
          <DataTable 
            headers={['Tipo / Número', 'Entidade', 'Data', 'Valor', 'Imposto', 'Status', 'Ações']}
            data={filteredRecords}
            renderRow={(record) => (
              <>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-black text-[10px] uppercase">
                      {record.type}
                    </div>
                    <div>
                      <span className="text-sm font-black text-slate-900 block">{record.number}</span>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Série: {record.serie || '0'}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black text-slate-900 truncate block max-w-[200px]">
                      {record.clienteId ? clients[record.clienteId] : suppliers[record.fornecedorId || ''] || 'Entidade não encontrada'}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      record.direction === 'in' ? "text-blue-600" : "text-slate-400"
                    )}>
                      {record.direction === 'in' ? 'Entrada (Compra)' : 'Saída (Venda)'}
                    </span>
                    {record.relatedId && (
                      <button
                        onClick={() => setActiveTab('os', record.relatedId)}
                        className="text-[10px] text-slate-400 hover:text-primary flex items-center gap-2 uppercase font-black tracking-widest transition-colors mt-1"
                      >
                        {serviceOrders[record.relatedId] || 'OS não encontrada'}
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-500">
                  {formatSafeDate(record.date)}
                </td>
                <td className="px-6 py-4 font-black text-slate-900 font-display">
                  {formatCurrency(record.value)}
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-500">
                  {formatCurrency(record.valorImposto || 0)}
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(record.status)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <AppButton 
                      variant="ghost"
                      size="sm"
                      onClick={() => openModal(record)}
                      className="w-8 h-8 !p-0"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </AppButton>
                    <AppButton 
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(record.id)}
                      className="w-8 h-8 !p-0 text-red-600 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </AppButton>
                  </div>
                </td>
              </>
            )}
          />
        </SectionCard>
      </div>

      {/* Modal Form */}
      <AppDialog
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingRecord ? 'Editar Registro Fiscal' : 'Novo Registro Fiscal'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Direção</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, direction: 'out', fornecedorId: '' })}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border",
                    formData.direction === 'out' 
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                      : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                  )}
                >
                  Saída
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, direction: 'in', clienteId: '' })}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border",
                    formData.direction === 'in' 
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20" 
                      : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                  )}
                >
                  Entrada
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Nota</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="nfse">NFS-e (Serviço)</option>
                <option value="nfe">NF-e (Produto)</option>
                <option value="cupom">Cupom Fiscal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Número"
              required
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            />
            <AppInput 
              label="Série"
              value={formData.serie}
              onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {formData.direction === 'out' ? 'Cliente' : 'Fornecedor'}
              </label>
              {formData.direction === 'out' ? (
                <select 
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  value={formData.clienteId}
                  onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                >
                  <option value="">Selecione um cliente</option>
                  {Object.entries(clients).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              ) : (
                <select 
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  value={formData.fornecedorId}
                  onChange={(e) => setFormData({ ...formData, fornecedorId: e.target.value })}
                >
                  <option value="">Selecione um fornecedor</option>
                  {Object.entries(suppliers).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">OS Relacionada (Opcional)</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                value={formData.relatedId}
                onChange={(e) => setFormData({ ...formData, relatedId: e.target.value })}
              >
                <option value="">Nenhuma</option>
                {Object.entries(serviceOrders).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Data de Emissão"
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="emitida">Emitida</option>
                <option value="pendente">Pendente</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AppInput 
              label="Valor Total"
              type="number"
              step="0.01"
              required
              icon={<DollarSign size={16} />}
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            />
            <AppInput 
              label="Valor Imposto"
              type="number"
              step="0.01"
              icon={<TrendingUp size={16} />}
              value={formData.valorImposto}
              onChange={(e) => setFormData({ ...formData, valorImposto: e.target.value })}
            />
          </div>

          <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="createTransactionFiscal"
                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                checked={formData.createTransaction}
                onChange={(e) => setFormData({ ...formData, createTransaction: e.target.checked })}
              />
              <label htmlFor="createTransactionFiscal" className="text-xs font-black text-slate-700 uppercase tracking-widest cursor-pointer">
                Lançar no Financeiro ({formData.direction === 'in' ? 'Contas a Pagar' : 'Contas a Receber'})
              </label>
            </div>

            {formData.createTransaction && (
              <AppInput 
                label="Data de Vencimento"
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações</label>
            <textarea 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm min-h-[100px]"
              rows={4}
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
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
              {editingRecord ? 'Salvar Alterações' : 'Registrar Nota'}
            </AppButton>
          </div>
        </form>
      </AppDialog>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Registro Fiscal?"
        message="Tem certeza que deseja excluir este registro fiscal? Esta ação não pode ser desfeita."
      />
    </PageContainer>
  );
};

export default Fiscal;
