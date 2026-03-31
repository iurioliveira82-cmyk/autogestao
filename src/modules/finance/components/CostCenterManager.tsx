import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  FolderOpen,
  MoreVertical
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { CostCenter, OperationType } from '../../../types';
import { useAuth } from '../../auth/Auth';
import { cn, handleFirestoreError } from '../../../utils';
import { toast } from 'sonner';

const CostCenterManager: React.FC = () => {
  const { profile } = useAuth();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    if (!window.confirm('Tem certeza que deseja excluir este centro de custo?')) return;
    try {
      await deleteDoc(doc(db, 'centros_custo', id));
      toast.success('Centro de custo excluído!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir centro de custo');
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
          <h3 className="text-xl font-black text-zinc-900">Centros de Custo</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Gestão de Categorias Financeiras</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-accent/20"
        >
          <Plus size={18} />
          Novo Centro de Custo
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar centros de custo..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((cc) => (
          <div key={cc.id} className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "p-3 rounded-2xl",
                cc.active ? "bg-green-50 text-green-600" : "bg-zinc-50 text-zinc-400"
              )}>
                <FolderOpen size={24} />
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => openModal(cc)}
                  className="p-2 text-zinc-400 hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(cc.id!)}
                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-black text-zinc-900">{cc.name}</h4>
                {!cc.active && (
                  <span className="px-2 py-0.5 bg-zinc-100 text-zinc-400 text-[8px] font-black uppercase tracking-widest rounded-full">Inativo</span>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-medium line-clamp-2">{cc.description || 'Sem descrição'}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-50 flex items-center justify-between">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</p>
              <div className="flex items-center gap-1.5">
                {cc.active ? (
                  <>
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Ativo</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} className="text-zinc-400" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Inativo</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-zinc-900">
                  {editingId ? 'Editar Centro' : 'Novo Centro'}
                </h3>
                <button onClick={closeModal} className="p-2 hover:bg-zinc-100 rounded-full transition-all">
                  <XCircle size={24} className="text-zinc-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nome</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    placeholder="Ex: Aluguel, Peças, Salários"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Descrição</label>
                  <textarea 
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all resize-none h-32"
                    placeholder="Detalhes sobre este centro de custo..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <input 
                    type="checkbox"
                    id="active"
                    className="w-5 h-5 rounded-lg border-zinc-300 text-accent focus:ring-accent"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  />
                  <label htmlFor="active" className="text-sm font-bold text-zinc-700 cursor-pointer">Centro de Custo Ativo</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-6 py-4 border border-zinc-200 rounded-2xl font-bold text-sm text-zinc-600 hover:bg-zinc-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-accent text-accent-foreground rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-accent/20"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostCenterManager;
