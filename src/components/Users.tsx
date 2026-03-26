import React, { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, 
  Shield, 
  ShieldCheck, 
  ShieldAlert,
  Lock,
  CheckCircle2,
  XCircle,
  Search,
  Edit2,
  Save,
  X,
  Plus,
  UserPlus,
  Trash2
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, UserPermissions, ModulePermissions, OperationType, UserRole } from '../types';
import { useAuth } from './Auth';
import { defaultPermissions, adminPermissions } from '../lib/permissions';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const Users: React.FC = () => {
  const { profile } = useAuth();
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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditingPermissions, setIsEditingPermissions] = useState(false);
  const [editedPermissions, setEditedPermissions] = useState<UserPermissions | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUserFormData, setNewUserFormData] = useState({
    name: '',
    email: '',
    role: 'employee' as UserRole
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false);
  const [basicInfoForm, setBasicInfoForm] = useState({
    name: '',
    role: 'employee' as UserRole
  });

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleEditPermissions = (user: UserProfile) => {
    setSelectedUser(user);
    const perms = user.permissions || (user.role === 'admin' ? adminPermissions : defaultPermissions);
    setEditedPermissions(JSON.parse(JSON.stringify(perms)));
    setIsEditingPermissions(false);
    setIsEditingBasicInfo(false);
    setBasicInfoForm({
      name: user.name,
      role: user.role
    });
  };

  const startEditing = () => {
    if (selectedUser) {
      const perms = selectedUser.permissions || (selectedUser.role === 'admin' ? adminPermissions : defaultPermissions);
      setEditedPermissions(JSON.parse(JSON.stringify(perms)));
      setIsEditingPermissions(true);
    }
  };

  const startEditingBasicInfo = () => {
    if (selectedUser) {
      setBasicInfoForm({
        name: selectedUser.name,
        role: selectedUser.role
      });
      setIsEditingBasicInfo(true);
    }
  };

  const handleTogglePermission = (module: keyof UserPermissions, action: keyof ModulePermissions) => {
    if (!editedPermissions) return;

    const currentModulePerms = editedPermissions[module] || defaultPermissions[module];

    setEditedPermissions({
      ...editedPermissions,
      [module]: {
        ...currentModulePerms,
        [action]: !currentModulePerms[action]
      }
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedUser || !editedPermissions) return;

    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        permissions: editedPermissions,
        updatedAt: serverTimestamp()
      });
      toast.success('Permissões atualizadas com sucesso!');
      setIsEditingPermissions(false);
      // Update local state to reflect changes immediately
      setSelectedUser({ ...selectedUser, permissions: editedPermissions });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.uid}`);
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!selectedUser) return;

    try {
      const updates: any = {
        name: basicInfoForm.name,
        role: basicInfoForm.role,
        updatedAt: serverTimestamp()
      };

      // If role changed, update permissions to defaults if they were admin or vice versa
      if (basicInfoForm.role !== selectedUser.role) {
        updates.permissions = basicInfoForm.role === 'admin' ? adminPermissions : defaultPermissions;
      }

      await updateDoc(doc(db, 'users', selectedUser.uid), updates);
      toast.success('Informações atualizadas com sucesso!');
      setIsEditingBasicInfo(false);
      setSelectedUser({ 
        ...selectedUser, 
        name: basicInfoForm.name, 
        role: basicInfoForm.role,
        permissions: updates.permissions || selectedUser.permissions
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.uid}`);
    }
  };

  const handleUpdateRole = async (newRole: UserRole) => {
    if (!selectedUser) return;

    try {
      const newPermissions = newRole === 'admin' ? adminPermissions : defaultPermissions;
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        role: newRole,
        permissions: newPermissions,
        updatedAt: serverTimestamp()
      });
      toast.success('Cargo atualizado com sucesso!');
      setSelectedUser({ ...selectedUser, role: newRole, permissions: newPermissions });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.uid}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await deleteDoc(doc(db, 'users', selectedUser.uid));
      toast.success('Usuário removido do sistema.');
      setSelectedUser(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${selectedUser.uid}`);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFormData.name || !newUserFormData.email) {
      toast.error('Nome e email são obrigatórios.');
      return;
    }

    try {
      // Check if user already exists
      const q = query(collection(db, 'users'), where('email', '==', newUserFormData.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        toast.error('Este email já está cadastrado.');
        return;
      }

      // Use email as temporary UID for pre-created users
      const userDocRef = doc(db, 'users', newUserFormData.email);
      const newProfile: UserProfile = {
        uid: newUserFormData.email,
        name: newUserFormData.name,
        email: newUserFormData.email,
        role: newUserFormData.role,
        permissions: newUserFormData.role === 'admin' ? adminPermissions : defaultPermissions,
        createdAt: new Date().toISOString()
      };

      await setDoc(userDocRef, {
        ...newProfile,
        createdAt: serverTimestamp()
      });

      toast.success('Usuário adicionado com sucesso!');
      setIsAddModalOpen(false);
      setNewUserFormData({ name: '', email: '', role: 'employee' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const modules: { id: keyof UserPermissions; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'clients', label: 'Clientes' },
    { id: 'vehicles', label: 'Veículos' },
    { id: 'os', label: 'Ordens de Serviço' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'services', label: 'Serviços' },
    { id: 'inventory', label: 'Estoque' },
    { id: 'suppliers', label: 'Fornecedores' },
    { id: 'stock', label: 'Movimentações' },
    { id: 'finance', label: 'Financeiro' },
    { id: 'resale', label: 'Revenda' },
    { id: 'fiscal', label: 'Fiscal' },
    { id: 'users', label: 'Usuários' },
  ];

  const actions: { id: keyof ModulePermissions; label: string }[] = [
    { id: 'view', label: 'Visualizar' },
    { id: 'create', label: 'Criar' },
    { id: 'edit', label: 'Editar' },
    { id: 'delete', label: 'Excluir' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar usuários..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-zinc-200"
        >
          <UserPlus size={20} />
          Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Users List */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden h-fit">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50">
            <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <UsersIcon size={20} className="text-zinc-400" />
              Usuários do Sistema
            </h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {loading ? (
              <div className="p-8 text-center text-zinc-400 italic">Carregando...</div>
            ) : filteredUsers.length > 0 ? filteredUsers.map((user) => (
              <button
                key={user.uid}
                onClick={() => handleEditPermissions(user)}
                className={cn(
                  "w-full p-4 flex items-center gap-4 hover:bg-zinc-50 transition-all text-left",
                  selectedUser?.uid === user.uid && "bg-zinc-50 ring-2 ring-inset ring-zinc-900"
                )}
              >
                <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 font-bold border border-zinc-200">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{user.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
                <div className={cn(
                  "p-1.5 rounded-lg",
                  user.role === 'admin' ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                )}>
                  {user.role === 'admin' ? <ShieldCheck size={16} /> : <Shield size={16} />}
                </div>
              </button>
            )) : (
              <div className="p-8 text-center text-zinc-400 italic">Nenhum usuário encontrado.</div>
            )}
          </div>
        </div>

        {/* Permissions Section */}
        <div className="lg:col-span-2 space-y-6">
          {selectedUser ? (
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-900 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-xl font-black">
                    {selectedUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    {isEditingBasicInfo ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white font-bold focus:outline-none focus:ring-2 focus:ring-white/50"
                          value={basicInfoForm.name}
                          onChange={(e) => setBasicInfoForm({ ...basicInfoForm, name: e.target.value })}
                        />
                        <div className="flex items-center gap-2">
                          <select
                            className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-zinc-300 uppercase tracking-widest font-bold focus:outline-none cursor-pointer hover:text-white transition-colors"
                            value={basicInfoForm.role}
                            onChange={(e) => setBasicInfoForm({ ...basicInfoForm, role: e.target.value as UserRole })}
                          >
                            <option value="employee" className="bg-zinc-900">Funcionário</option>
                            <option value="admin" className="bg-zinc-900">Administrador</option>
                          </select>
                          <button
                            onClick={handleSaveBasicInfo}
                            className="text-[10px] bg-white text-zinc-900 px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setIsEditingBasicInfo(false)}
                            className="text-[10px] bg-white/10 text-white px-2 py-1 rounded font-bold uppercase tracking-widest hover:bg-white/20 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          {selectedUser.name}
                          <button 
                            onClick={startEditingBasicInfo}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-400"
                          >
                            <Edit2 size={14} />
                          </button>
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400 uppercase tracking-widest font-bold">
                            {selectedUser.role === 'admin' ? 'Administrador' : 'Funcionário'}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-widest transition-colors"
                          >
                            Excluir Usuário
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isEditingPermissions ? (
                    <>
                      <button 
                        onClick={() => setIsEditingPermissions(false)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400"
                      >
                        <X size={24} />
                      </button>
                      <button 
                        onClick={handleSavePermissions}
                        className="flex items-center gap-2 bg-white text-zinc-900 px-4 py-2 rounded-xl font-bold hover:bg-zinc-100 transition-all shadow-lg"
                      >
                        <Save size={18} />
                        Salvar
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={startEditing}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-all"
                    >
                      <Edit2 size={18} />
                      Editar Permissões
                    </button>
                  )}
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-center gap-2 mb-8">
                  <ShieldAlert size={20} className="text-zinc-400" />
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Permissões Granulares</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                        <th className="px-4 py-4">Módulo</th>
                        {actions.map(action => (
                          <th key={action.id} className="px-4 py-4 text-center">{action.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {modules.map(module => (
                        <tr key={module.id} className="group hover:bg-zinc-50/50 transition-colors">
                          <td className="px-4 py-4">
                            <span className="text-sm font-bold text-zinc-700">{module.label}</span>
                          </td>
                          {actions.map(action => {
                            const isAllowed = selectedUser.role === 'admin' 
                              ? true 
                              : (editedPermissions 
                                  ? !!editedPermissions[module.id]?.[action.id] 
                                  : !!selectedUser.permissions?.[module.id]?.[action.id]);
                            return (
                              <td key={action.id} className="px-4 py-4 text-center">
                                <button
                                  type="button"
                                  disabled={!isEditingPermissions || selectedUser.role === 'admin'}
                                  onClick={() => handleTogglePermission(module.id, action.id)}
                                  className={cn(
                                    "p-2 rounded-xl transition-all",
                                    isAllowed 
                                      ? "text-green-600 bg-green-50 hover:bg-green-100" 
                                      : "text-zinc-300 bg-zinc-50 hover:bg-zinc-100",
                                    (!isEditingPermissions || selectedUser.role === 'admin') && "cursor-default opacity-80"
                                  )}
                                >
                                  {isAllowed ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedUser.role === 'admin' && (
                  <div className="mt-8 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center gap-3 text-zinc-500 italic text-sm">
                    <Lock size={18} />
                    Administradores possuem acesso total e irrestrito a todos os módulos e ações.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-zinc-200 border-dashed p-12 text-center">
              <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-200 mb-6">
                <Shield size={40} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Gerenciamento de Acesso</h3>
              <p className="text-zinc-500 max-w-xs mx-auto">
                Selecione um usuário na lista ao lado para visualizar e gerenciar suas permissões de acesso ao sistema.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Excluir Usuário?</h3>
              <p className="text-zinc-500 mb-8">
                Tem certeza que deseja remover <strong>{selectedUser?.name}</strong> do sistema? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-zinc-200 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteUser}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">Novo Usuário</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={newUserFormData.name}
                  onChange={(e) => setNewUserFormData({ ...newUserFormData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Email</label>
                <input 
                  type="email" 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={newUserFormData.email}
                  onChange={(e) => setNewUserFormData({ ...newUserFormData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Cargo / Função</label>
                <select 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  value={newUserFormData.role}
                  onChange={(e) => setNewUserFormData({ ...newUserFormData, role: e.target.value as any })}
                >
                  <option value="employee">Funcionário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-zinc-200 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
