import { UserPermissions, ModulePermissions } from '../types';

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
  users: { ...defaultModulePermissions, view: false }
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
  users: adminModulePermissions
};
