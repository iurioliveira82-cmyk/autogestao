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
  Tag
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Supplier } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { toast } from 'sonner';

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const { canCreate, canEdit, canDelete } = usePermissions('suppliers');

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    category: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Supplier[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Supplier);
      });
      setSuppliers(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast.success('Fornecedor cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar fornecedor.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este fornecedor?')) {
      try {
        await deleteDoc(doc(db, 'suppliers', id));
        toast.success('Fornecedor excluído com sucesso!');
      } catch (error) {
        console.error(error);
        toast.error('Erro ao excluir fornecedor.');
      }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CNPJ ou categoria..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {canCreate && (
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
          >
            <Plus size={20} />
            Novo Fornecedor
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-zinc-400 italic">Carregando fornecedores...</div>
        ) : filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier) => (
          <div key={supplier.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group relative">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                <Truck size={24} />
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button 
                    onClick={() => openModal(supplier)}
                    className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDelete(supplier.id)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 truncate">{supplier.name}</h3>
                {supplier.cnpj && <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">CNPJ: {supplier.cnpj}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Phone size={14} className="text-zinc-400" />
                  <span>{supplier.phone}</span>
                </div>
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Mail size={14} className="text-zinc-400" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <MapPin size={14} className="text-zinc-400" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
                {supplier.category && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Tag size={14} className="text-zinc-400" />
                    <span className="px-2 py-0.5 bg-zinc-100 rounded-md text-[10px] font-bold uppercase tracking-wider">{supplier.category}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-zinc-200 text-center">
            <Truck size={48} className="mx-auto text-zinc-200 mb-4" />
            <p className="text-zinc-400 font-medium">Nenhum fornecedor encontrado.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">
                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <Trash2 size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Nome / Razão Social</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">CNPJ</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Telefone</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Endereço</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Categoria / Ramo</label>
                <input 
                  type="text" 
                  placeholder="Ex: Peças, Pneus, Óleos..."
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
                  {editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
