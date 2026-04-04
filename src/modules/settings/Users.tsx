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
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { AppDialog } from '../../components/ui/AppDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/StatusBadge';
import SectionCard from '../../components/layout/SectionCard';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../auth/Auth';
import { UserProfile, UserPermissions, UserRole, ModulePermissions, OperationType } from '../../types';
import { handleFirestoreError, cn } from '../../utils';
import { toast } from 'sonner';

const adminPermissions: UserPermissions = {
  dashboard: { view: true, create: true, edit: true, delete: true },
  clients: { view: true, create: true, edit: true, delete: true },
  vehicles: { view: true, create: true, edit: true, delete: true },
  os: { view: true, create: true, edit: true, delete: true },
  finance: { view: true, create: true, edit: true, delete: true },
  inventory: { view: true, create: true, edit: true, delete: true },
  resale: { view: true, create: true, edit: true, delete: true },
  analytics: { view: true, create: true, edit: true, delete: true },
  agenda: { view: true, create: true, edit: true, delete: true },
  leads: { view: true, create: true, edit: true, delete: true },
  services: { view: true, create: true, edit: true, delete: true },
  suppliers: { view: true, create: true, edit: true, delete: true },
  stock: { view: true, create: true, edit: true, delete: true },
  users: { view: true, create: true, edit: true, delete: true },
  fiscal: { view: true, create: true, edit: true, delete: true },
  automations: { view: true, create: true, edit: true, delete: true }
};

const defaultPermissions: UserPermissions = {
  dashboard: { view: true, create: false, edit: false, delete: false },
  clients: { view: true, create: true, edit: true, delete: false },
  vehicles: { view: true, create: true, edit: true, delete: false },
  os: { view: true, create: true, edit: true, delete: false },
  finance: { view: false, create: false, edit: false, delete: false },
  inventory: { view: true, create: false, edit: false, delete: false },
  resale: { view: false, create: false, edit: false, delete: false },
  analytics: { view: false, create: false, edit: false, delete: false },
  agenda: { view: true, create: true, edit: true, delete: true },
  leads: { view: true, create: true, edit: true, delete: true },
  services: { view: true, create: false, edit: false, delete: false },
  suppliers: { view: true, create: false, edit: false, delete: false },
  stock: { view: true, create: false, edit: false, delete: false },
  users: { view: false, create: false, edit: false, delete: false },
  fiscal: { view: false, create: false, edit: false, delete: false },
  automations: { view: false, create: false, edit: false, delete: false }
};

const getPermissionsByRole = (role: UserRole): UserPermissions => {
  if (role === 'admin') return adminPermissions;
  return defaultPermissions;
};

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
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <AppInput 
            placeholder="Buscar usuários..." 
            icon={<Search size={18} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <AppButton 
          onClick={() => setIsAddModalOpen(true)}
          icon={<UserPlus size={18} />}
        >
          Novo Usuário
        </AppButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Users List */}
        <div className="lg:col-span-1">
          <SectionCard 
            title="Usuários" 
            subtitle="Lista de acessos"
            icon={<UsersIcon size={18} className="text-slate-400" />}
            className="p-0 overflow-hidden"
          >
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-slate-400 text-xs italic">Carregando...</p>
                </div>
              ) : filteredUsers.length > 0 ? filteredUsers.map((user) => (
                <button
                  key={user.uid}
                  onClick={() => handleEditPermissions(user)}
                  className={cn(
                    "w-full p-5 flex items-center gap-4 hover:bg-slate-50 transition-all text-left group",
                    selectedUser?.uid === user.uid && "bg-slate-50 border-l-4 border-primary"
                  )}
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 font-black border border-slate-200 group-hover:scale-105 transition-transform">
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{user.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-widest">{user.email}</p>
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
                    user.role === 'admin' ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    {user.role === 'admin' ? <ShieldCheck size={16} /> : <Shield size={16} />}
                  </div>
                </button>
              )) : (
                <div className="p-12 text-center">
                  <UsersIcon size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Nenhum usuário</p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Permissions Section */}
        <div className="lg:col-span-2 space-y-6">
          {selectedUser ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-primary text-white relative overflow-hidden">
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
                            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-[10px] text-slate-300 uppercase tracking-widest font-black focus:outline-none cursor-pointer hover:text-white transition-colors"
                            value={basicInfoForm.role}
                            onChange={(e) => setBasicInfoForm({ ...basicInfoForm, role: e.target.value as UserRole })}
                          >
                            {roles.map(role => (
                              <option key={role.id} value={role.id} className="bg-primary">{role.label}</option>
                            ))}
                          </select>
                          <AppButton
                            size="sm"
                            onClick={handleSaveBasicInfo}
                            className="bg-white text-primary hover:bg-slate-100"
                          >
                            Salvar
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="secondary"
                            onClick={() => setIsEditingBasicInfo(false)}
                            className="bg-white/10 text-white border-transparent hover:bg-white/20"
                          >
                            Cancelar
                          </AppButton>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-2xl font-black flex items-center gap-3">
                          {selectedUser.name}
                          <button 
                            onClick={startEditingBasicInfo}
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/60"
                          >
                            <Edit2 size={16} />
                          </button>
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-white/80 uppercase tracking-widest font-black px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                            {roles.find(r => r.id === selectedUser.role)?.label || selectedUser.role}
                          </span>
                          {selectedUser.status && (
                            <StatusBadge 
                              status={selectedUser.status === 'active' ? 'paid' : selectedUser.status === 'pending' ? 'pending' : 'cancelled'} 
                              label={selectedUser.status === 'active' ? 'Ativo' : selectedUser.status === 'pending' ? 'Pendente' : 'Inativo'}
                            />
                          )}
                          <span className="text-white/20">•</span>
                          <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="text-[10px] text-red-300 hover:text-red-200 font-black uppercase tracking-widest transition-colors"
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
                        className="p-3 hover:bg-white/10 rounded-2xl transition-colors text-white/60"
                      >
                        <X size={24} />
                      </button>
                      <AppButton 
                        onClick={handleSavePermissions}
                        className="bg-white text-primary hover:bg-slate-100"
                        icon={<Save size={20} />}
                      >
                        Salvar
                      </AppButton>
                    </>
                  ) : (
                    <AppButton 
                      onClick={startEditing}
                      variant="secondary"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/10"
                      icon={<Edit2 size={20} />}
                    >
                      Permissões
                    </AppButton>
                  )}
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Controle de Acesso</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Defina o que este usuário pode fazer</p>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4">Módulo</th>
                        {actions.map(action => (
                          <th key={action.id} className="px-6 py-4 text-center">{action.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {modules.map(module => (
                        <tr key={module.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-5">
                            <span className="text-sm font-black text-slate-700">{module.label}</span>
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
                                      ? "text-primary bg-primary/10 hover:bg-primary/20" 
                                      : "text-slate-300 bg-slate-50 hover:bg-slate-100",
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
                  <div className="mt-8 p-6 bg-primary text-white rounded-[2rem] flex items-center gap-4 shadow-xl shadow-primary/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white relative z-10">
                      <Lock size={24} />
                    </div>
                    <div className="relative z-10">
                      <p className="text-xs font-black uppercase tracking-widest">Acesso Irrestrito</p>
                      <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mt-1">Administradores possuem controle total sobre todos os módulos.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                <Shield size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Gerenciamento de Acesso</h3>
              <p className="text-slate-500 max-w-xs mx-auto">
                Selecione um usuário na lista ao lado para visualizar e gerenciar suas permissões de acesso ao sistema.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <AppDialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Novo Usuário"
        subtitle="Acesso ao Sistema"
      >
        <form onSubmit={handleAddUser} className="space-y-6">
          <AppInput 
            label="Nome Completo"
            required
            value={newUserFormData.name}
            onChange={(e) => setNewUserFormData({ ...newUserFormData, name: e.target.value })}
          />

          <AppInput 
            label="Email"
            type="email" 
            required
            value={newUserFormData.email}
            onChange={(e) => setNewUserFormData({ ...newUserFormData, email: e.target.value })}
          />

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cargo / Função</label>
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
            <AppButton 
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </AppButton>
            <AppButton 
              type="submit"
              className="flex-1"
            >
              Adicionar
            </AppButton>
          </div>
        </form>
      </AppDialog>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteUser}
        title="Excluir Usuário?"
        message={`Tem certeza que deseja excluir ${selectedUser?.name}? Esta ação removerá permanentemente o acesso deste usuário ao sistema.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  );
};

export default Users;
