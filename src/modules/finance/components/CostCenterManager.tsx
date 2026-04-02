import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  FolderOpen
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { CostCenter, OperationType } from '../../../types';
import { useAuth } from '../../auth/Auth';
import { cn, handleFirestoreError } from '../../../utils';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Modal } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { usePermissions } from '../../../hooks/usePermissions';

const CostCenterManager: React.FC = () => {
  const { profile } = useAuth();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { canCreate, canEdit, canDelete } = usePermissions('finance');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'centros_custo'),
      where('empresaId', '==', profile.empresaId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CostCenter[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as CostCenter));
      setCostCenters(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'centros_custo');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error('Nome é obrigatório');

    try {
      if (editingId) {
        await updateDoc(doc(db, 'centros_custo', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Centro de custo atualizado!');
      } else {
        await addDoc(collection(db, 'centros_custo'), {
          ...formData,
          empresaId: profile.empresaId,
          createdAt: serverTimestamp()
        });
        toast.success('Centro de custo criado!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar centro de custo');
    }
  };

  const handleDelete = async (id: string) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'centros_custo', itemToDelete));
      toast.success('Centro de custo excluído!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir centro de custo');
    } finally {
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const openModal = (cc?: CostCenter) => {
    if (cc) {
      setEditingId(cc.id!);
      setFormData({
        name: cc.name,
        description: cc.description || '',
        active: cc.active
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const filtered = costCenters.filter(cc => 
    cc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cc.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">Centros de Custo</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Categorias Financeiras</p>
        </div>
        {canCreate && (
          <Button 
            onClick={() => openModal()}
            icon={<Plus size={18} />}
          >
            Novo Centro de Custo
          </Button>
        )}
      </div>

      <SearchBar 
        placeholder="Buscar centros de custo..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((cc) => (
          <div key={cc.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "p-3 rounded-2xl",
                cc.active ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-400"
              )}>
                <FolderOpen size={24} />
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                {canEdit && (
                  <button 
                    onClick={() => openModal(cc)}
                    className="p-2 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(cc.id!)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-black text-slate-900">{cc.name}</h4>
                {!cc.active && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded-full">Inativo</span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium line-clamp-2">{cc.description || 'Sem descrição'}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
              <div className="flex items-center gap-1.5">
                {cc.active ? (
                  <>
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Ativo</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inativo</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar Centro' : 'Novo Centro'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
            <input 
              type="text"
              required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              placeholder="Ex: Aluguel, Peças, Salários"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
            <textarea 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all resize-none h-32"
              placeholder="Detalhes sobre este centro de custo..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <input 
              type="checkbox"
              id="active"
              className="w-5 h-5 rounded-lg border-slate-300 text-accent focus:ring-accent"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            />
            <label htmlFor="active" className="text-sm font-bold text-slate-700 cursor-pointer">Centro de Custo Ativo</label>
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
        title="Excluir Centro de Custo"
        message="Tem certeza que deseja excluir este centro de custo? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default CostCenterManager;
