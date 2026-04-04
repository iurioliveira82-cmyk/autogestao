import { UserPermissions, ModulePermissions, UserRole } from '../../types';

export const defaultModulePermissions: ModulePermissions = {
  view: true,
  create: false,
  edit: false,
  delete: false
};

export const adminModulePermissions: ModulePermissions = {
  view: true,
  create: true,
  edit: true,
  delete: true
};

export const defaultPermissions: UserPermissions = {
  dashboard: defaultModulePermissions,
  clients: defaultModulePermissions,
  vehicles: defaultModulePermissions,
  os: defaultModulePermissions,
  agenda: defaultModulePermissions,
  services: defaultModulePermissions,
  inventory: defaultModulePermissions,
  finance: { ...defaultModulePermissions, view: false },
  resale: defaultModulePermissions,
  suppliers: defaultModulePermissions,
  stock: defaultModulePermissions,
  users: { ...defaultModulePermissions, view: false },
  fiscal: { ...defaultModulePermissions, view: false },
  analytics: { ...defaultModulePermissions, view: false },
  automations: { ...defaultModulePermissions, view: false },
  leads: defaultModulePermissions
};

export const adminPermissions: UserPermissions = {
  dashboard: adminModulePermissions,
  clients: adminModulePermissions,
  vehicles: adminModulePermissions,
  os: adminModulePermissions,
  agenda: adminModulePermissions,
  services: adminModulePermissions,
  inventory: adminModulePermissions,
  finance: adminModulePermissions,
  resale: adminModulePermissions,
  suppliers: adminModulePermissions,
  stock: adminModulePermissions,
  users: adminModulePermissions,
  fiscal: adminModulePermissions,
  analytics: adminModulePermissions,
  automations: adminModulePermissions,
  leads: adminModulePermissions
};

export const gerentePermissions: UserPermissions = {
  ...adminPermissions,
  users: { ...adminModulePermissions, delete: false }
};

export const tecnicoPermissions: UserPermissions = {
  ...defaultPermissions,
  os: { ...defaultModulePermissions, edit: true },
  inventory: { ...defaultModulePermissions, view: true },
  services: { ...defaultModulePermissions, view: true }
};

export const financeiroPermissions: UserPermissions = {
  ...defaultPermissions,
  finance: adminModulePermissions,
  fiscal: adminModulePermissions
};

export const estoquePermissions: UserPermissions = {
  ...defaultPermissions,
  inventory: adminModulePermissions,
  stock: adminModulePermissions,
  suppliers: adminModulePermissions
};

export const atendimentoPermissions: UserPermissions = {
  ...defaultPermissions,
  clients: adminModulePermissions,
  vehicles: adminModulePermissions,
  os: { ...defaultModulePermissions, create: true, view: true },
  agenda: adminModulePermissions
};

export const getPermissionsByRole = (role: UserRole): UserPermissions => {
  switch (role) {
    case 'admin': return adminPermissions;
    case 'gerente': return gerentePermissions;
    case 'tecnico': return tecnicoPermissions;
    case 'financeiro': return financeiroPermissions;
    case 'estoque': return estoquePermissions;
    case 'atendimento': return atendimentoPermissions;
    case 'consultor': return defaultPermissions;
    default: return defaultPermissions;
  }
};
