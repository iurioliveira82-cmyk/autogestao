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
import { db, auth } from '../firebase';
import { FiscalRecord, OperationType, Client } from '../types';
import { useAuth } from './Auth';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmationModal } from './ConfirmationModal';

interface FiscalProps {
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: any) => void;
}

const Fiscal: React.FC<FiscalProps> = ({ setActiveTab }) => {
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
    series: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    value: '',
    taxValue: '',
    status: 'emitted' as 'emitted' | 'cancelled' | 'pending',
    clientId: '',
    supplierId: '',
    direction: 'out' as 'in' | 'out',
    relatedOSId: '',
    observations: '',
    createTransaction: false,
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (!profile || !canView) return;

    // Fetch Fiscal Records
    const q = query(collection(db, 'fiscalRecords'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: FiscalRecord[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as FiscalRecord);
      });
      setRecords(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'fiscalRecords');
      setLoading(false);
    });

      // Fetch Clients for mapping
      const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
        const map: Record<string, string> = {};
        snapshot.forEach(doc => {
          map[doc.id] = doc.data().name;
        });
        setClients(map);
      });
  
      // Fetch Suppliers for mapping
      const unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
        const map: Record<string, string> = {};
        snapshot.forEach(doc => {
          map[doc.id] = doc.data().name;
        });
        setSuppliers(map);
      });

    // Fetch Service Orders for mapping
    const unsubscribeOS = onSnapshot(collection(db, 'serviceOrders'), (snapshot) => {
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
    
    if (!formData.number || !formData.value || (formData.direction === 'out' && !formData.clientId) || (formData.direction === 'in' && !formData.supplierId)) {
      toast.error('Número, valor e cliente/fornecedor são obrigatórios.');
      return;
    }

    try {
      const val = parseFloat(formData.value);
      const data = {
        type: formData.type,
        number: formData.number,
        series: formData.series,
        date: new Date(formData.date).toISOString(),
        value: val,
        taxValue: formData.taxValue ? parseFloat(formData.taxValue) : 0,
        status: formData.status,
        clientId: formData.direction === 'out' ? formData.clientId : null,
        supplierId: formData.direction === 'in' ? formData.supplierId : null,
        direction: formData.direction,
        relatedOSId: formData.relatedOSId || null,
        observations: formData.observations,
        updatedAt: serverTimestamp()
      };

      if (editingRecord) {
        await updateDoc(doc(db, 'fiscalRecords', editingRecord.id), data);
        toast.success('Registro fiscal atualizado!');
      } else {
        const newDoc = await addDoc(collection(db, 'fiscalRecords'), {
          ...data,
          createdAt: new Date().toISOString()
        });

        // Create financial transaction if requested
        if (formData.createTransaction) {
          const isEntry = formData.direction === 'in';
          const entityName = isEntry ? suppliers[formData.supplierId] : clients[formData.clientId];
          
          await addDoc(collection(db, 'transactions'), {
            type: isEntry ? 'out' : 'in',
            value: val,
            category: 'Fiscal',
            description: `Nota Fiscal ${formData.type.toUpperCase()} #${formData.number} - ${entityName}`,
            date: new Date(formData.dueDate).toISOString(),
            status: 'pending',
            paymentMethod: 'Boleto',
            supplierId: isEntry ? formData.supplierId : undefined,
            relatedOSId: formData.relatedOSId || undefined
          });
        }

        toast.success('Nota fiscal registrada!');
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingRecord ? OperationType.UPDATE : OperationType.CREATE, 'fiscalRecords');
    }
  };

  const handleDelete = async (id: string) => {
    setRecordToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'fiscalRecords', recordToDelete));
      toast.success('Registro excluído!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `fiscalRecords/${recordToDelete}`);
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
        series: record.series || '',
        date: format(new Date(record.date), 'yyyy-MM-dd'),
        value: record.value.toString(),
        taxValue: record.taxValue?.toString() || '',
        status: record.status,
        clientId: record.clientId || '',
        supplierId: (record as any).supplierId || '',
        direction: (record as any).direction || 'out',
        relatedOSId: record.relatedOSId || '',
        observations: record.observations || '',
        createTransaction: false,
        dueDate: format(new Date(), 'yyyy-MM-dd')
      });
    } else {
      setEditingRecord(null);
      setFormData({
        type: 'nfse',
        number: '',
        series: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        value: '',
        taxValue: '',
        status: 'emitted',
        clientId: '',
        supplierId: '',
        direction: 'out',
        relatedOSId: '',
        observations: '',
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
    (r.clientId && clients[r.clientId]?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    ((r as any).supplierId && suppliers[(r as any).supplierId]?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalValue = filteredRecords.reduce((acc, curr) => acc + curr.value, 0);
  const totalTax = filteredRecords.reduce((acc, curr) => acc + (curr.taxValue || 0), 0);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText size={20} />
            </div>
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Total de Notas</span>
          </div>
          <h3 className="text-2xl font-bold text-zinc-900">{filteredRecords.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-green-50 text-green-600 rounded-xl">
              <DollarSign size={20} />
            </div>
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Valor Total</span>
          </div>
          <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(totalValue)}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Total Impostos</span>
          </div>
          <h3 className="text-2xl font-bold text-zinc-900">{formatCurrency(totalTax)}</h3>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por número ou cliente..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-3 bg-white border border-zinc-200 rounded-2xl text-zinc-500 hover:bg-zinc-50 transition-colors shadow-sm">
            <Download size={20} />
          </button>
          {canCreate && (
            <button 
              onClick={() => openModal()}
              className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
            >
              <Plus size={20} />
              Emitir Nota
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-8 py-4">Tipo / Número</th>
                <th className="px-8 py-4">Entidade</th>
                <th className="px-8 py-4">Data</th>
                <th className="px-8 py-4">Valor</th>
                <th className="px-8 py-4">Imposto</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-10 text-center text-zinc-400 italic">Carregando registros fiscais...</td>
                </tr>
              ) : filteredRecords.length > 0 ? filteredRecords.map((record) => (
                <tr key={record.id} className="group hover:bg-zinc-50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-500 font-bold text-[10px] uppercase">
                        {record.type}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-zinc-900 block">{record.number}</span>
                        <span className="text-[10px] text-zinc-400 uppercase">Série: {record.series || '0'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-medium text-zinc-600 truncate block max-w-[200px]">
                      {record.clientId ? clients[record.clientId] : suppliers[(record as any).supplierId] || 'Entidade não encontrada'}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      (record as any).direction === 'in' ? "text-blue-600" : "text-zinc-400"
                    )}>
                      {(record as any).direction === 'in' ? 'Entrada (Compra)' : 'Saída (Venda)'}
                    </span>
                    {record.relatedOSId && (
                      <button
                        onClick={() => setActiveTab('os', record.relatedOSId)}
                        className="text-[10px] text-zinc-400 hover:text-zinc-900 flex items-center gap-1 uppercase transition-colors"
                      >
                        {serviceOrders[record.relatedOSId] || 'OS não encontrada'}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </td>
                  <td className="px-8 py-5 text-sm text-zinc-500">
                    {format(new Date(record.date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-8 py-5 font-bold text-zinc-900">
                    {formatCurrency(record.value)}
                  </td>
                  <td className="px-8 py-5 text-sm text-zinc-500">
                    {formatCurrency(record.taxValue || 0)}
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      record.status === 'emitted' ? "bg-green-50 text-green-600" :
                      record.status === 'cancelled' ? "bg-red-50 text-red-600" :
                      "bg-orange-50 text-orange-600"
                    )}>
                      {record.status === 'emitted' ? <CheckCircle2 size={10} /> : 
                       record.status === 'cancelled' ? <XCircle size={10} /> : <Clock size={10} />}
                      {record.status === 'emitted' ? 'Emitida' : 
                       record.status === 'cancelled' ? 'Cancelada' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openModal(record)}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-8 py-10 text-center text-zinc-400 italic">Nenhum registro fiscal encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">
                {editingRecord ? 'Editar Registro Fiscal' : 'Novo Registro Fiscal'}
              </h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Direção</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, direction: 'out', supplierId: '' })}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all border",
                        formData.direction === 'out' 
                          ? "bg-zinc-900 text-white border-zinc-900" 
                          : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      Saída (Venda)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, direction: 'in', clientId: '' })}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs transition-all border",
                        formData.direction === 'in' 
                          ? "bg-blue-600 text-white border-blue-600" 
                          : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      Entrada (Compra)
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Tipo de Nota</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
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
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Número</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Série</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.series}
                    onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">
                    {formData.direction === 'out' ? 'Cliente' : 'Fornecedor'}
                  </label>
                  {formData.direction === 'out' ? (
                    <select 
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    >
                      <option value="">Selecione um cliente</option>
                      {Object.entries(clients).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  ) : (
                    <select 
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    >
                      <option value="">Selecione um fornecedor</option>
                      {Object.entries(suppliers).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">OS Relacionada (Opcional)</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.relatedOSId}
                    onChange={(e) => setFormData({ ...formData, relatedOSId: e.target.value })}
                  >
                    <option value="">Nenhuma</option>
                    {Object.entries(serviceOrders).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Data de Emissão</label>
                  <input 
                    type="date" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="emitted">Emitida</option>
                    <option value="pending">Pendente</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Valor Total</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Valor Imposto</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.taxValue}
                    onChange={(e) => setFormData({ ...formData, taxValue: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="createTransactionFiscal"
                    className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    checked={formData.createTransaction}
                    onChange={(e) => setFormData({ ...formData, createTransaction: e.target.checked })}
                  />
                  <label htmlFor="createTransactionFiscal" className="text-sm font-bold text-zinc-700">
                    Lançar no Financeiro ({formData.direction === 'in' ? 'Contas a Pagar' : 'Contas a Receber'})
                  </label>
                </div>

                {formData.createTransaction && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Data de Vencimento</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Observações</label>
                <textarea 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all resize-none"
                  rows={3}
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
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
