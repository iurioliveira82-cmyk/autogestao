import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Truck, 
  Phone, 
  Mail, 
  MapPin, 
  MoreVertical, 
  Edit2, 
  Trash2,
  Tag,
  History,
  XCircle,
  ArrowUpCircle
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Supplier, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { handleFirestoreError } from '../../utils';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { toast } from 'sonner';

interface SuppliersProps {
  setActiveTab?: (tab: string, itemId?: string, supplierId?: string, itemStatus?: any) => void;
}

const Suppliers: React.FC<SuppliersProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const { canView, canCreate, canEdit, canDelete } = usePermissions('suppliers');

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    category: ''
  });

  const validateCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, '');
    
    if (cleaned.length !== 14) return false;
    
    // Check for repeated digits
    if (/^(\d)\1+$/.test(cleaned)) return false;
    
    // Validate check digits
    const calculateDigit = (numbers: string, weight: number[]) => {
      let sum = 0;
      for (let i = 0; i < numbers.length; i++) {
        sum += parseInt(numbers[i]) * weight[i];
      }
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    
    const weight1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weight2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    const digit1 = calculateDigit(cleaned.substring(0, 12), weight1);
    const digit2 = calculateDigit(cleaned.substring(0, 13), weight2);
    
    return digit1 === parseInt(cleaned[12]) && digit2 === parseInt(cleaned[13]);
  };

  const maskCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 14);
    return cleaned
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  useEffect(() => {
    if (!profile?.empresaId || !canView) return;

    const q = query(
      collection(db, 'fornecedores'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Supplier[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Supplier);
      });
      setSuppliers(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'fornecedores');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile, canView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    if (!profile) return;

    if (formData.cnpj && !validateCNPJ(formData.cnpj)) {
      toast.error('CNPJ inválido. Por favor, verifique o número informado.');
      return;
    }

    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'fornecedores', editingSupplier.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'fornecedores'), {
          ...formData,
          empresaId: profile.empresaId,
          createdAt: new Date().toISOString()
        });
        toast.success('Fornecedor cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingSupplier ? OperationType.UPDATE : OperationType.CREATE, 'fornecedores');
    }
  };

  const handleDelete = async (id: string) => {
    setSupplierToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await deleteDoc(doc(db, 'fornecedores', supplierToDelete));
      toast.success('Fornecedor excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `fornecedores/${supplierToDelete}`);
    } finally {
      setSupplierToDelete(null);
    }
  };

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        cnpj: supplier.cnpj || '',
        phone: supplier.phone,
        email: supplier.email || '',
        address: supplier.address || '',
        category: supplier.category || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        cnpj: '',
        phone: '',
        email: '',
        address: '',
        category: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cnpj?.includes(searchTerm) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <Truck size={48} className="mb-4" />
        <p className="text-lg font-medium">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-3xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CNPJ ou categoria..." 
            className="w-full pl-12 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {canCreate && (
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm"
          >
            <Plus size={20} />
            Novo Fornecedor
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-400 text-sm italic">Carregando fornecedores...</p>
            </div>
          </div>
        ) : filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier) => (
          <div 
            key={supplier.id} 
            className="bg-white rounded-[2rem] border border-zinc-200 p-6 hover:shadow-xl hover:shadow-zinc-100 transition-all group relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Truck size={28} />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {setActiveTab && (
                  <button 
                    onClick={() => setActiveTab('stock', undefined, supplier.id)}
                    className="p-2 text-accent hover:bg-accent/10 rounded-xl transition-all"
                    title="Lançar Estoque"
                  >
                    <ArrowUpCircle size={16} />
                  </button>
                )}
                {canEdit && (
                  <button 
                    onClick={() => openModal(supplier)}
                    className="p-2 text-zinc-400 hover:text-accent hover:bg-zinc-100 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(supplier.id)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-zinc-900 line-clamp-1">{supplier.name}</h3>
                {supplier.cnpj && <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">CNPJ: {supplier.cnpj}</p>}
              </div>

              <div className="bg-zinc-50 rounded-2xl p-4 space-y-3 border border-zinc-100">
                <div className="flex items-center gap-3 text-xs font-bold text-zinc-600">
                  <Phone size={14} className="text-zinc-400" />
                  <span>{supplier.phone}</span>
                </div>
                {supplier.email && (
                  <div className="flex items-center gap-3 text-xs font-bold text-zinc-600">
                    <Mail size={14} className="text-zinc-400" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-3 text-xs font-bold text-zinc-600">
                    <MapPin size={14} className="text-zinc-400" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                {supplier.category ? (
                  <div className="flex items-center gap-2">
                    <Tag size={12} className="text-zinc-400" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{supplier.category}</span>
                  </div>
                ) : <div />}
                
                <button
                  onClick={() => setActiveTab?.('stock', undefined, supplier.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
                >
                  <History size={12} />
                  Histórico
                </button>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-2 opacity-40">
              <Truck size={48} className="text-zinc-300" />
              <p className="text-zinc-500 text-sm font-medium">Nenhum fornecedor encontrado.</p>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-xl font-black text-zinc-900">
                  {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                </h3>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Dados Cadastrais</p>
              </div>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-accent rounded-xl hover:bg-zinc-100 transition-all">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nome / Razão Social</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-bold"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">CNPJ</label>
                  <input 
                    type="text" 
                    placeholder="00.000.000/0000-00"
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Telefone</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">E-mail</label>
                  <input 
                    type="email" 
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Endereço</label>
                <input 
                  type="text" 
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Categoria / Ramo</label>
                <input 
                  type="text" 
                  placeholder="Ex: Peças, Pneus, Óleos..."
                  className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>

              <div className="pt-4 flex items-center gap-4">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-4 border border-zinc-200 text-zinc-600 font-bold rounded-2xl hover:bg-zinc-50 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-accent text-accent-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm"
                >
                  {editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
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
        title="Excluir Fornecedor?"
        message="Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Suppliers;
