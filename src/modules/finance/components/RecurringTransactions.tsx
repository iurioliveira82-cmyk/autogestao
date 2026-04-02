import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { RecurringTransaction, CostCenter, OperationType } from '../../../types';
import { useAuth } from '../../auth/Auth';
import { formatCurrency, cn, handleFirestoreError } from '../../../utils';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Modal } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { usePermissions } from '../../../hooks/usePermissions';

const RecurringTransactions: React.FC = () => {
  const { profile } = useAuth();
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { canCreate, canEdit, canDelete } = usePermissions('finance');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: 'out' as 'in' | 'out',
    value: '',
    category: '',
    description: '',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    dayOfMonth: 1,
    costCenterId: '',
    active: true
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'transacoes_recorrentes'),
      where('empresaId', '==', profile.empresaId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: RecurringTransaction[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as RecurringTransaction));
      setRecurring(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transacoes_recorrentes');
      setLoading(false);
    });

    const unsubscribeCC = onSnapshot(
      query(collection(db, 'centros_custo'), where('empresaId', '==', profile.empresaId), where('active', '==', true)),
      (snapshot) => {
        const list: CostCenter[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as CostCenter));
        setCostCenters(list);
      }
    );

    return () => {
      unsubscribe();
      unsubscribeCC();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.value || !formData.category) return toast.error('Valor e categoria são obrigatórios');

    try {
      const data = {
        ...formData,
        value: parseFloat(formData.value),
        dayOfMonth: parseInt(formData.dayOfMonth.toString()),
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'transacoes_recorrentes', editingId), data);
        toast.success('Recorrência atualizada!');
      } else {
        await addDoc(collection(db, 'transacoes_recorrentes'), {
          ...data,
          empresaId: profile.empresaId,
          createdAt: serverTimestamp()
        });
        toast.success('Recorrência criada!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar recorrência');
    }
  };

  const handleDelete = async (id: string) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'transacoes_recorrentes', itemToDelete));
      toast.success('Recorrência excluída!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir recorrência');
    } finally {
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const openModal = (rt?: RecurringTransaction) => {
    if (rt) {
      setEditingId(rt.id!);
      setFormData({
        type: rt.type,
        value: rt.value.toString(),
        category: rt.category,
        description: rt.description || '',
        frequency: rt.frequency,
        dayOfMonth: rt.dayOfMonth || 1,
        costCenterId: rt.costCenterId || '',
        active: rt.active
      });
    } else {
      setEditingId(null);
      setFormData({
        type: 'out',
        value: '',
        category: '',
        description: '',
        frequency: 'monthly',
        dayOfMonth: 1,
        costCenterId: '',
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const filtered = recurring.filter(rt => 
    rt.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rt.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">Transações Recorrentes</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Automação de Lançamentos</p>
        </div>
        {canCreate && (
          <Button 
            onClick={() => openModal()}
            icon={<Plus size={18} />}
          >
            Nova Recorrência
          </Button>
        )}
      </div>

      <SearchBar 
        placeholder="Buscar recorrências..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((rt) => (
          <div key={rt.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "p-3 rounded-2xl",
                rt.type === 'in' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              )}>
                <RefreshCw size={24} className={rt.active ? "animate-spin-slow" : ""} />
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                {canEdit && (
                  <button 
                    onClick={() => openModal(rt)}
                    className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(rt.id!)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-black text-slate-900">{rt.category}</h4>
                <span className={cn(
                  "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full",
                  rt.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                )}>
                  {rt.active ? 'Ativa' : 'Pausada'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium line-clamp-1">{rt.description || 'Sem descrição'}</p>
              <p className="text-lg font-black text-slate-900 mt-2">{formatCurrency(rt.value)}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Frequência</p>
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    {rt.frequency === 'monthly' ? `Dia ${rt.dayOfMonth}` : rt.frequency}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo</p>
                <div className="flex items-center gap-1.5">
                  {rt.type === 'in' ? (
                    <>
                      <ArrowUpRight size={12} className="text-green-500" />
                      <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Entrada</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight size={12} className="text-red-500" />
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Saída</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar Recorrência' : 'Nova Recorrência'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
              <div className="flex p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'in' })}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    formData.type === 'in' ? "bg-white text-green-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'out' })}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    formData.type === 'out' ? "bg-white text-red-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Saída
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="number"
                  step="0.01"
                  required
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  placeholder="0,00"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
              <input 
                type="text"
                required
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                placeholder="Ex: Aluguel, Software"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Centro de Custo</label>
              <select 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                value={formData.costCenterId}
                onChange={(e) => setFormData({ ...formData, costCenterId: e.target.value })}
              >
                <option value="">Nenhum</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
            <input 
              type="text"
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              placeholder="Detalhes da transação..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Frequência</label>
              <select 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dia do Mês</label>
              <input 
                type="number"
                min="1"
                max="31"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                value={formData.dayOfMonth}
                onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <input 
              type="checkbox"
              id="active"
              className="w-5 h-5 rounded-lg border-slate-300 text-accent focus:ring-accent"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            />
            <label htmlFor="active" className="text-sm font-bold text-slate-700 cursor-pointer">Recorrência Ativa</label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline"
              onClick={closeModal}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              className="flex-1"
            >
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Recorrência"
        message="Tem certeza que deseja excluir esta recorrência? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default RecurringTransactions;
