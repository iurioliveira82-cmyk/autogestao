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
import { formatCurrency, cn, handleFirestoreError } from '../../utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';

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
    date: format(new Date(), 'yyyy-MM-dd'),
    value: '',
    valorImposto: '',
    status: 'emitida' as 'emitida' | 'cancelada' | 'pendente',
    clienteId: '',
    fornecedorId: '',
    direction: 'out' as 'in' | 'out',
    relatedId: '',
    observacoes: '',
    createTransaction: false,
    dueDate: format(new Date(), 'yyyy-MM-dd')
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
    }
  };

  const openModal = (record?: FiscalRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        type: record.type,
        number: record.number,
        serie: record.serie || '',
        date: format(new Date(record.date), 'yyyy-MM-dd'),
        value: record.value.toString(),
        valorImposto: record.valorImposto?.toString() || '',
        status: record.status as any,
        clienteId: record.clienteId || '',
        fornecedorId: record.fornecedorId || '',
        direction: record.direction || 'out',
        relatedId: record.relatedId || '',
        observacoes: record.observacoes || '',
        createTransaction: false,
        dueDate: format(new Date(), 'yyyy-MM-dd')
      });
    } else {
      setEditingRecord(null);
      setFormData({
        type: 'nfse',
        number: '',
        serie: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        value: '',
        valorImposto: '',
        status: 'emitida',
        clienteId: '',
        fornecedorId: '',
        direction: 'out',
        relatedId: '',
        observacoes: '',
        createTransaction: false,
        dueDate: format(new Date(), 'yyyy-MM-dd')
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

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <XCircle size={48} className="mb-4" />
        <p className="text-lg font-medium">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
        <div className="modern-card !p-8 group hover:scale-[1.02] transition-all duration-500">
          <div className="flex items-center gap-5 mb-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:rotate-12 transition-transform">
              <FileText size={24} />
            </div>
            <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">Total de Notas</span>
          </div>
          <h3 className="text-4xl font-black text-zinc-900 font-display tracking-tighter">{filteredRecords.length}</h3>
        </div>
        <div className="modern-card !p-8 group hover:scale-[1.02] transition-all duration-500">
          <div className="flex items-center gap-5 mb-4">
            <div className="p-4 bg-green-50 text-green-600 rounded-2xl group-hover:rotate-12 transition-transform">
              <DollarSign size={24} />
            </div>
            <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">Valor Total</span>
          </div>
          <h3 className="text-4xl font-black text-zinc-900 font-display tracking-tighter">{formatCurrency(totalValue)}</h3>
        </div>
        <div className="modern-card !p-8 group hover:scale-[1.02] transition-all duration-500">
          <div className="flex items-center gap-5 mb-4">
            <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl group-hover:rotate-12 transition-transform">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">Total Impostos</span>
          </div>
          <h3 className="text-4xl font-black text-zinc-900 font-display tracking-tighter">{formatCurrency(totalTax)}</h3>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={22} />
          <input 
            type="text" 
            placeholder="Buscar por número ou cliente..." 
            className="w-full pl-16 pr-6 py-4 bg-white border border-zinc-100 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all shadow-sm text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-4 bg-white border border-zinc-100 rounded-2xl text-zinc-500 hover:bg-zinc-50 hover:text-accent transition-all shadow-sm">
            <Download size={22} />
          </button>
          {canCreate && (
            <button 
              onClick={() => openModal()}
              className="flex items-center justify-center gap-3 bg-zinc-900 text-white px-10 py-4 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all shadow-xl shadow-zinc-900/10"
            >
              <Plus size={20} />
              Emitir Nota
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="modern-card !p-0 overflow-hidden group">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em]">
                <th className="px-10 py-8">Tipo / Número</th>
                <th className="px-10 py-8">Entidade</th>
                <th className="px-10 py-8">Data</th>
                <th className="px-10 py-8">Valor</th>
                <th className="px-10 py-8">Imposto</th>
                <th className="px-10 py-8">Status</th>
                <th className="px-10 py-8 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-10 py-20 text-center text-zinc-400 italic font-medium">Carregando registros fiscais...</td>
                </tr>
              ) : filteredRecords.length > 0 ? filteredRecords.map((record) => (
                <tr key={record.id} className="group/row hover:bg-zinc-50/80 transition-all duration-300">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 font-black text-[10px] uppercase group-hover/row:bg-white transition-colors">
                        {record.type}
                      </div>
                      <div>
                        <span className="text-base font-black text-zinc-900 block group-hover/row:text-accent transition-colors">{record.number}</span>
                        <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Série: {record.serie || '0'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black text-zinc-900 truncate block max-w-[200px]">
                        {record.clienteId ? clients[record.clienteId] : suppliers[record.fornecedorId || ''] || 'Entidade não encontrada'}
                      </span>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em]",
                        record.direction === 'in' ? "text-blue-600" : "text-zinc-400"
                      )}>
                        {record.direction === 'in' ? 'Entrada (Compra)' : 'Saída (Venda)'}
                      </span>
                      {record.relatedId && (
                        <button
                          onClick={() => setActiveTab('os', record.relatedId)}
                          className="text-[10px] text-zinc-400 hover:text-accent flex items-center gap-2 uppercase font-black tracking-widest transition-colors mt-1"
                        >
                          {serviceOrders[record.relatedId] || 'OS não encontrada'}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-sm font-bold text-zinc-500">
                    {format(new Date(record.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-10 py-8 font-black text-zinc-900 font-display text-lg">
                    {formatCurrency(record.value)}
                  </td>
                  <td className="px-10 py-8 text-sm font-bold text-zinc-500">
                    {formatCurrency(record.valorImposto || 0)}
                  </td>
                  <td className="px-10 py-8">
                    <span className={cn(
                      "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border",
                      record.status === 'emitida' ? "bg-green-50 text-green-600 border-green-100" :
                      record.status === 'cancelada' ? "bg-red-50 text-red-600 border-red-100" :
                      "bg-orange-50 text-orange-600 border-orange-100"
                    )}>
                      {record.status === 'emitida' ? <CheckCircle2 size={12} /> : 
                       record.status === 'cancelada' ? <XCircle size={12} /> : <Clock size={12} />}
                      {record.status === 'emitida' ? 'Emitida' : 
                       record.status === 'cancelada' ? 'Cancelada' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all duration-300">
                      <button 
                        onClick={() => openModal(record)}
                        className="p-3 text-zinc-400 hover:text-accent hover:bg-white rounded-xl transition-all shadow-sm"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(record.id)}
                        className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-10 py-20 text-center text-zinc-400 italic font-medium">Nenhum registro fiscal encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-10 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 font-display">
                  {editingRecord ? 'Editar Registro Fiscal' : 'Novo Registro Fiscal'}
                </h3>
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-1">Preencha os dados da nota</p>
              </div>
              <button onClick={closeModal} className="p-3 text-zinc-400 hover:text-accent hover:bg-white rounded-2xl transition-all shadow-sm">
                <XCircle size={28} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Direção</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, direction: 'out', fornecedorId: '' })}
                      className={cn(
                        "flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border",
                        formData.direction === 'out' 
                          ? "bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20" 
                          : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200"
                      )}
                    >
                      Saída (Venda)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, direction: 'in', clienteId: '' })}
                      className={cn(
                        "flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border",
                        formData.direction === 'in' 
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20" 
                          : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200"
                      )}
                    >
                      Entrada (Compra)
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Tipo de Nota</label>
                  <select 
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700 appearance-none"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="nfse">NFS-e (Serviço)</option>
                    <option value="nfe">NF-e (Produto)</option>
                    <option value="cupom">Cupom Fiscal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Número</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Série</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700"
                    value={formData.serie}
                    onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">
                    {formData.direction === 'out' ? 'Cliente' : 'Fornecedor'}
                  </label>
                  {formData.direction === 'out' ? (
                    <select 
                      required
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700 appearance-none"
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
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700 appearance-none"
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
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">OS Relacionada (Opcional)</label>
                  <select 
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700 appearance-none"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Data de Emissão</label>
                  <input 
                    type="date" 
                    required
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Status</label>
                  <select 
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700 appearance-none"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="emitida">Emitida</option>
                    <option value="pendente">Pendente</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Valor Total</label>
                  <div className="relative">
                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      className="w-full pl-14 pr-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-black text-zinc-900"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Valor Imposto</label>
                  <div className="relative">
                    <TrendingUp className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full pl-14 pr-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-black text-zinc-900"
                      value={formData.valorImposto}
                      onChange={(e) => setFormData({ ...formData, valorImposto: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6 p-8 bg-zinc-50 rounded-[2rem] border border-zinc-100">
                <div className="flex items-center gap-4">
                  <input 
                    type="checkbox" 
                    id="createTransactionFiscal"
                    className="w-6 h-6 rounded-lg border-zinc-200 text-accent focus:ring-accent transition-all cursor-pointer"
                    checked={formData.createTransaction}
                    onChange={(e) => setFormData({ ...formData, createTransaction: e.target.checked })}
                  />
                  <label htmlFor="createTransactionFiscal" className="text-sm font-black text-zinc-700 uppercase tracking-widest cursor-pointer">
                    Lançar no Financeiro ({formData.direction === 'in' ? 'Contas a Pagar' : 'Contas a Receber'})
                  </label>
                </div>

                {formData.createTransaction && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Data de Vencimento</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-6 py-4 bg-white border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all text-sm font-bold text-zinc-700"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Observações</label>
                <textarea 
                  className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none text-sm font-medium text-zinc-700"
                  rows={4}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>

              <div className="pt-8 flex items-center gap-6">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-8 py-5 border border-zinc-100 text-zinc-500 font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-8 py-5 bg-zinc-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-accent hover:text-accent-foreground transition-all shadow-xl shadow-zinc-900/10 active:scale-95"
                >
                  {editingRecord ? 'Salvar Alterações' : 'Registrar Nota'}
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
        title="Excluir Registro Fiscal?"
        message="Tem certeza que deseja excluir este registro fiscal? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Fiscal;
