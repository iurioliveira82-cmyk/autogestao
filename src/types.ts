export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type UserRole = 'admin' | 'employee';

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface UserPermissions {
  dashboard: ModulePermissions;
  clients: ModulePermissions;
  vehicles: ModulePermissions;
  os: ModulePermissions;
  agenda: ModulePermissions;
  services: ModulePermissions;
  inventory: ModulePermissions;
  finance: ModulePermissions;
  resale: ModulePermissions;
  suppliers: ModulePermissions;
  stock: ModulePermissions;
  users: ModulePermissions;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: UserPermissions;
  createdAt: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year?: number;
  color?: string;
  km?: number;
  clientId: string;
  createdAt: string;
}

export interface ServiceProduct {
  inventoryItemId: string;
  name: string;
  quantity: number;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  cost: number;
  averageTime?: number;
  products?: ServiceProduct[];
}

export interface ServiceOrderItem {
  serviceId: string;
  name: string;
  price: number;
  cost: number;
  products?: ServiceProduct[];
}

export type OSStatus = 'waiting' | 'confirmed' | 'in-progress' | 'finished' | 'cancelled';

export interface ServiceOrder {
  id: string;
  clientId: string;
  vehicleId: string;
  services: ServiceOrderItem[];
  status: OSStatus;
  photosBefore?: string[];
  photosAfter?: string[];
  observations?: string;
  totalValue: number;
  totalCost: number;
  discount?: number;
  paymentMethod?: 'cash' | 'pix' | 'card';
  notificationSent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  vehicleId: string;
  serviceIds: string[];
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled';
}

export interface Supplier {
  id: string;
  name: string;
  cnpj?: string;
  phone: string;
  email?: string;
  address?: string;
  category?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: 'in' | 'out';
  quantity: number;
  date: string;
  reason: string;
  supplierId?: string;
  cost?: number;
  userId: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
  price: number;
  cost?: number;
  supplierId?: string;
  category?: string;
}

export interface Transaction {
  id: string;
  type: 'in' | 'out';
  value: number;
  category: string;
  description: string;
  date: string;
  status: 'paid' | 'pending';
  paymentMethod?: string;
  relatedOSId?: string;
}

export interface ResaleVehicle {
  id: string;
  brand: string;
  model: string;
  year?: number;
  buyPrice: number;
  sellPrice?: number;
  status: 'available' | 'reserved' | 'sold';
  createdAt: string;
}
