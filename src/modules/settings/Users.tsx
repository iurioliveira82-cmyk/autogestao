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
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { UserProfile, UserPermissions, ModulePermissions, OperationType, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { defaultPermissions, adminPermissions, getPermissionsByRole } from '../auth/permissions';
import { cn, handleFirestoreError } from '../../utils';
import { toast } from 'sonner';

const Users: React.FC<{ setActiveTab?: (tab: string, itemId?: string) => void }> = ({ setActiveTab }) => {
  const { profile } = useAuth();
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
    role: 'consultor' as UserRole
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false);
  const [basicInfoForm, setBasicInfoForm] = useState({
    name: '',
    role: 'consultor' as UserRole
  });

  const roles: { id: UserRole; label: string }[] = [
    { id: 'admin', label: 'Administrador' },
    { id: 'gerente', label: 'Gerente' },
    { id: 'consultor', label: 'Consultor' },
    { id: 'tecnico', label: 'Técnico' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'atendimento', label: 'Atendimento' },
  ];

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'usuarios'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'usuarios');
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
      await updateDoc(doc(db, 'usuarios', selectedUser.uid), {
        permissions: editedPermissions,
        updatedAt: serverTimestamp()
      });
      toast.success('Permissões atualizadas com sucesso!');
      setIsEditingPermissions(false);
      // Update local state to reflect changes immediately
      setSelectedUser({ ...selectedUser, permissions: editedPermissions });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `usuarios/${selectedUser.uid}`);
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

      // If role changed, update permissions to defaults
      if (basicInfoForm.role !== selectedUser.role) {
        updates.permissions = getPermissionsByRole(basicInfoForm.role);
      }

      await updateDoc(doc(db, 'usuarios', selectedUser.uid), updates);
      toast.success('Informações atualizadas com sucesso!');
      setIsEditingBasicInfo(false);
      setSelectedUser({ 
        ...selectedUser, 
        name: basicInfoForm.name, 
        role: basicInfoForm.role,
        permissions: updates.permissions || selectedUser.permissions
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `usuarios/${selectedUser.uid}`);
    }
  };

  const handleUpdateRole = async (newRole: UserRole) => {
    if (!selectedUser) return;

    try {
      const newPermissions = getPermissionsByRole(newRole);
      await updateDoc(doc(db, 'usuarios', selectedUser.uid), {
        role: newRole,
        permissions: newPermissions,
        updatedAt: serverTimestamp()
      });
      toast.success('Cargo atualizado com sucesso!');
      setSelectedUser({ ...selectedUser, role: newRole, permissions: newPermissions });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `usuarios/${selectedUser.uid}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await deleteDoc(doc(db, 'usuarios', selectedUser.uid));
      toast.success('Usuário removido do sistema.');
      setSelectedUser(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `usuarios/${selectedUser.uid}`);
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
      const q = query(
        collection(db, 'usuarios'), 
        where('email', '==', newUserFormData.email),
        where('empresaId', '==', profile.empresaId)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        toast.error('Este email já está cadastrado.');
        return;
      }

      // Use email as temporary UID for pre-created users
      const userDocRef = doc(db, 'usuarios', newUserFormData.email);
      const newProfile: UserProfile = {
        uid: newUserFormData.email,
        name: newUserFormData.name,
        email: newUserFormData.email,
        role: newUserFormData.role,
        empresaId: profile.empresaId,
        permissions: getPermissionsByRole(newUserFormData.role),
        createdAt: new Date().toISOString()
      };

      await setDoc(userDocRef, {
        ...newProfile,
        createdAt: serverTimestamp()
      });

      toast.success('Usuário adicionado com sucesso!');
      setIsAddModalOpen(false);
      setNewUserFormData({ name: '', email: '', role: 'consultor' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'usuarios');
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
    { id: 'analytics', label: 'Analytics' },
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-3xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar usuários..." 
            className="w-full pl-12 pr-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm text-zinc-900 dark:text-zinc-100 dark:bg-zinc-900/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm"
        >
          <UserPlus size={20} />
          Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Users List */}
        <div className="lg:col-span-1 bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden h-fit">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2 uppercase tracking-widest">
              <UsersIcon size={18} className="text-zinc-400" />
              Usuários
            </h3>
          </div>
          <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-zinc-400 text-xs italic">Carregando...</p>
              </div>
            ) : filteredUsers.length > 0 ? filteredUsers.map((user) => (
              <button
                key={user.uid}
                onClick={() => handleEditPermissions(user)}
                className={cn(
                  "w-full p-5 flex items-center gap-4 hover:bg-zinc-50 transition-all text-left group",
                  selectedUser?.uid === user.uid && "bg-zinc-50 border-l-4 border-accent"
                )}
              >
                <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-600 font-black border border-zinc-200 group-hover:scale-105 transition-transform">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-zinc-900 truncate">{user.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-zinc-400 truncate uppercase tracking-widest">{user.email}</p>
                    {user.status && (
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        user.status === 'active' ? "bg-green-500" : user.status === 'pending' ? "bg-yellow-500" : "bg-red-500"
                      )} />
                    )}
                  </div>
                </div>
                <div className={cn(
                  "p-2 rounded-xl shadow-sm",
                  user.role === 'admin' ? "bg-accent text-accent-foreground" : "bg-zinc-100 text-zinc-400"
                )}>
                  {user.role === 'admin' ? <ShieldCheck size={16} /> : <Shield size={16} />}
                </div>
              </button>
            )) : (
              <div className="p-12 text-center">
                <UsersIcon size={32} className="mx-auto text-zinc-200 mb-2" />
                <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Nenhum usuário</p>
              </div>
            )}
          </div>
        </div>

        {/* Permissions Section */}
        <div className="lg:col-span-2 space-y-6">
          {selectedUser ? (
            <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-accent text-accent-foreground relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-2xl font-black border border-white/10 shadow-xl">
                    {selectedUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    {isEditingBasicInfo ? (
                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white font-black focus:outline-none focus:ring-2 focus:ring-white/50 w-full max-w-xs"
                          value={basicInfoForm.name}
                          onChange={(e) => setBasicInfoForm({ ...basicInfoForm, name: e.target.value })}
                        />
                        <div className="flex items-center gap-2">
                          <select
                            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-[10px] text-zinc-300 uppercase tracking-widest font-black focus:outline-none cursor-pointer hover:text-white transition-colors"
                            value={basicInfoForm.role}
                            onChange={(e) => setBasicInfoForm({ ...basicInfoForm, role: e.target.value as UserRole })}
                          >
                            {roles.map(role => (
                              <option key={role.id} value={role.id} className="bg-accent">{role.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={handleSaveBasicInfo}
                            className="text-[10px] bg-white text-accent px-4 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-zinc-100 transition-all shadow-lg"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setIsEditingBasicInfo(false)}
                            className="text-[10px] bg-white/10 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-white/20 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-2xl font-black flex items-center gap-3">
                          {selectedUser.name}
                          <button 
                            onClick={startEditingBasicInfo}
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-zinc-400"
                          >
                            <Edit2 size={16} />
                          </button>
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                            {roles.find(r => r.id === selectedUser.role)?.label || selectedUser.role}
                          </span>
                          {selectedUser.status && (
                            <span className={cn(
                              "text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-lg border",
                              selectedUser.status === 'active' ? "bg-green-500/10 text-green-400 border-green-500/20" : 
                              selectedUser.status === 'pending' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
                              "bg-red-500/10 text-red-400 border-red-500/20"
                            )}>
                              {selectedUser.status === 'active' ? 'Ativo' : selectedUser.status === 'pending' ? 'Pendente' : 'Inativo'}
                            </span>
                          )}
                          <span className="text-white/20">•</span>
                          <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="text-[10px] text-red-400 hover:text-red-300 font-black uppercase tracking-widest transition-colors"
                          >
                            Excluir Usuário
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                  {isEditingPermissions ? (
                    <>
                      <button 
                        onClick={() => setIsEditingPermissions(false)}
                        className="p-3 hover:bg-white/10 rounded-2xl transition-colors text-zinc-400"
                      >
                        <X size={24} />
                      </button>
                      <button 
                        onClick={handleSavePermissions}
                        className="flex items-center gap-2 bg-white text-accent px-6 py-3 rounded-2xl font-black hover:bg-zinc-100 transition-all shadow-xl"
                      >
                        <Save size={20} />
                        Salvar
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={startEditing}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-black transition-all border border-white/10"
                    >
                      <Edit2 size={20} />
                      Permissões
                    </button>
                  )}
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-widest">Controle de Acesso</h4>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Defina o que este usuário pode fazer</p>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                        <th className="px-6 py-4">Módulo</th>
                        {actions.map(action => (
                          <th key={action.id} className="px-6 py-4 text-center">{action.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {modules.map(module => (
                        <tr key={module.id} className="group hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-5">
                            <span className="text-sm font-black text-zinc-700">{module.label}</span>
                          </td>
                          {actions.map(action => {
                            const isAllowed = selectedUser.role === 'admin' 
                              ? true 
                              : (editedPermissions 
                                  ? !!editedPermissions[module.id]?.[action.id] 
                                  : !!selectedUser.permissions?.[module.id]?.[action.id]);
                            return (
                              <td key={action.id} className="px-6 py-5 text-center">
                                <button
                                  type="button"
                                  disabled={!isEditingPermissions || selectedUser.role === 'admin'}
                                  onClick={() => handleTogglePermission(module.id, action.id)}
                                  className={cn(
                                    "p-2.5 rounded-2xl transition-all shadow-sm",
                                    isAllowed 
                                      ? "text-accent-foreground bg-accent/10 hover:bg-accent/20" 
                                      : "text-zinc-300 bg-zinc-50 hover:bg-zinc-100",
                                    (!isEditingPermissions || selectedUser.role === 'admin') && "cursor-default opacity-80 shadow-none"
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
                  <div className="mt-8 p-6 bg-accent text-accent-foreground rounded-[2rem] flex items-center gap-4 shadow-xl shadow-accent/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white relative z-10">
                      <Lock size={24} />
                    </div>
                    <div className="relative z-10">
                      <p className="text-xs font-black uppercase tracking-widest">Acesso Irrestrito</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Administradores possuem controle total sobre todos os módulos.</p>
                    </div>
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

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-xl font-black text-zinc-900">Novo Usuário</h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Acesso ao Sistema</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  className="input-modern"
                  value={newUserFormData.name}
                  onChange={(e) => setNewUserFormData({ ...newUserFormData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Email</label>
                <input 
                  type="email" 
                  required
                  className="input-modern"
                  value={newUserFormData.email}
                  onChange={(e) => setNewUserFormData({ ...newUserFormData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cargo / Função</label>
                <select 
                  className="select-modern"
                  value={newUserFormData.role}
                  onChange={(e) => setNewUserFormData({ ...newUserFormData, role: e.target.value as any })}
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-6 py-4 border border-zinc-200 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-accent text-accent-foreground rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 text-sm"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center text-red-600 mx-auto mb-6 shadow-xl shadow-red-100/50">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Excluir Usuário?</h3>
              <p className="text-sm text-zinc-500 mb-8">
                Tem certeza que deseja excluir <span className="font-black text-zinc-900">{selectedUser.name}</span>? Esta ação removerá permanentemente o acesso deste usuário ao sistema.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-6 py-4 border border-zinc-200 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteUser}
                  className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 text-sm"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
