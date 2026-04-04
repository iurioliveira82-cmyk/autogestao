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
  ArrowUpCircle,
  Search
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Supplier, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { cn, handleFirestoreError } from '../../utils';
import { toast } from 'sonner';

// Layout Components
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/layout/SectionCard';

// UI Components
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { AppDialog } from '../../components/ui/AppDialog';
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
    if (/^(\d)\1+$/.test(cleaned)) return false;
    
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
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Truck size={48} className="mb-4" />
          <p className="text-lg font-black uppercase tracking-widest">Acesso restrito.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader 
        title="Fornecedores" 
        subtitle="Gerencie sua rede de fornecedores e parcerias comerciais."
        breadcrumbs={[{ label: 'Fornecedores' }]}
        actions={canCreate && (
          <AppButton onClick={() => openModal()} icon={<Plus size={18} />}>
            Novo Fornecedor
          </AppButton>
        )}
      />

      <div className="mb-6">
        <AppInput 
          placeholder="Buscar por nome, CNPJ ou categoria..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={<Search size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Carregando fornecedores...</p>
            </div>
          </div>
        ) : filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier) => (
          <SectionCard 
            key={supplier.id} 
            className="group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform border border-slate-200">
                <Truck size={24} />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {setActiveTab && (
                  <AppButton 
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab('stock', undefined, supplier.id)}
                    title="Lançar Estoque"
                    className="h-8 w-8 p-0"
                  >
                    <ArrowUpCircle size={14} />
                  </AppButton>
                )}
                {canEdit && (
                  <AppButton 
                    variant="secondary"
                    size="sm"
                    onClick={() => openModal(supplier)}
                    title="Editar"
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 size={14} />
                  </AppButton>
                )}
                {canDelete && (
                  <AppButton 
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDelete(supplier.id)}
                    title="Excluir"
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 size={14} className="text-rose-500" />
                  </AppButton>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 line-clamp-1 font-display">{supplier.name}</h3>
                {supplier.cnpj && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">CNPJ: {supplier.cnpj}</p>}
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <Phone size={14} className="text-slate-400" />
                  <span>{supplier.phone}</span>
                </div>
                {supplier.email && (
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                    <Mail size={14} className="text-slate-400" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                {supplier.category ? (
                  <div className="flex items-center gap-2">
                    <Tag size={12} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{supplier.category}</span>
                  </div>
                ) : <div />}
                
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab?.('stock', undefined, supplier.id)}
                  className="h-8 px-3"
                >
                  <History size={12} className="mr-1.5" />
                  Histórico
                </AppButton>
              </div>
            </div>
          </SectionCard>
        )) : (
          <div className="col-span-full py-20 text-center">
            <div className="flex flex-col items-center gap-2 opacity-40">
              <Truck size={48} className="text-slate-300" />
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Nenhum fornecedor encontrado.</p>
            </div>
          </div>
        )}
      </div>

      <AppDialog
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AppInput 
              label="Nome / Razão Social"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <AppInput 
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AppInput 
              label="Telefone"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <AppInput 
              label="E-mail"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <AppInput 
            label="Endereço"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <AppInput 
            label="Categoria / Ramo"
            placeholder="Ex: Peças, Pneus, Óleos..."
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />

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
              {editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
            </AppButton>
          </div>
        </form>
      </AppDialog>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Fornecedor?"
        message="Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita."
      />
    </PageContainer>
  );
};

export default Suppliers;
