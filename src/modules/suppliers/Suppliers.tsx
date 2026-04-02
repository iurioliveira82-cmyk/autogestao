import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Truck, 
  Phone, 
  Mail, 
  MapPin, 
  Edit2, 
  Trash2,
  Tag,
  History,
  ArrowUpCircle
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Supplier, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { cn, handleFirestoreError } from '../../utils';
import { toast } from 'sonner';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchBar } from '../../components/ui/SearchBar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

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
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Truck size={48} className="mb-4" />
        <p className="text-lg font-medium">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Fornecedores" 
        description="Gerencie seus fornecedores e parcerias."
        action={canCreate && (
          <Button onClick={() => openModal()} variant="primary" icon={<Plus size={18} />}>
            Novo Fornecedor
          </Button>
        )}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SearchBar 
          placeholder="Buscar por nome, CNPJ ou categoria..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm italic">Carregando fornecedores...</p>
            </div>
          </div>
        ) : filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier) => (
          <div 
            key={supplier.id} 
            className="modern-card group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
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
                    className="p-2 text-slate-400 hover:text-accent hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(supplier.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">{supplier.name}</h3>
                {supplier.cnpj && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">CNPJ: {supplier.cnpj}</p>}
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 space-y-3 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <Phone size={14} className="text-slate-400" />
                  <span>{supplier.phone}</span>
                </div>
                {supplier.email && (
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <Mail size={14} className="text-slate-400" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                {supplier.category ? (
                  <div className="flex items-center gap-2">
                    <Tag size={12} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{supplier.category}</span>
                  </div>
                ) : <div />}
                
                <button
                  onClick={() => setActiveTab?.('stock', undefined, supplier.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
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
              <Truck size={48} className="text-slate-300" />
              <p className="text-slate-500 text-sm font-medium">Nenhum fornecedor encontrado.</p>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome / Razão Social</label>
              <input 
                type="text" 
                required
                className="input-modern"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CNPJ</label>
              <input 
                type="text" 
                placeholder="00.000.000/0000-00"
                className="input-modern"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
              <input 
                type="text" 
                required
                className="input-modern"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
              <input 
                type="email" 
                className="input-modern"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Endereço</label>
            <input 
              type="text" 
              className="input-modern"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Categoria / Ramo</label>
            <input 
              type="text" 
              placeholder="Ex: Peças, Pneus, Óleos..."
              className="input-modern"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>

          <div className="pt-4 flex items-center gap-4">
            <Button 
              type="button"
              variant="outline"
              onClick={closeModal}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              variant="primary"
              className="flex-1"
            >
              {editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
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
