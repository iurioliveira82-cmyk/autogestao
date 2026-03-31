export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type UserRole = 'admin' | 'gerente' | 'consultor' | 'tecnico' | 'financeiro' | 'estoque' | 'atendimento';

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  plan: 'basic' | 'pro' | 'enterprise';
  createdAt: string;
}

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
  fiscal: ModulePermissions;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  empresaId: string;
  permissions?: UserPermissions;
  createdAt: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  empresaId: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  address?: string;
  status: 'active' | 'inactive';
  creditLimit?: number;
  interestRate?: number;
  birthDate?: string;
  contactPreference?: 'whatsapp' | 'email' | 'phone';
  purchaseHistory?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  empresaId: string;
  clienteId: string;
  plate: string;
  brand: string;
  model: string;
  year?: number;
  color?: string;
  km?: number;
  createdAt: string;
}

export type OSStatus = 
  | 'orcamento' 
  | 'aguardando_aprovacao' 
  | 'aprovada' 
  | 'em_execucao' 
  | 'aguardando_peca' 
  | 'finalizada' 
  | 'entregue' 
  | 'cancelada' 
  | 'garantia';

export interface ServiceOrderItem {
  id?: string;
  serviceId?: string;
  name: string;
  price: number;
  quantity: number;
  cost?: number;
  produtos?: ServiceProduct[];
}

export interface PartOrderItem {
  id?: string;
  itemId?: string;
  name: string;
  price: number;
  quantity: number;
  cost?: number;
}

export interface OSStatusHistory {
  status: OSStatus;
  usuarioId: string;
  timestamp: string;
  notes?: string;
}

export interface ServiceOrder {
  id: string;
  empresaId: string;
  numeroOS: number;
  clienteId: string;
  veiculoId: string;
  orcamentoId?: string;
  agendamentoId?: string;
  tecnicoResponsavelId?: string;
  status: OSStatus;
  prazoEntrega?: string;
  valorTotal: number;
  desconto: number;
  observations?: string;
  paymentMethod?: 'cash' | 'pix' | 'card' | 'transfer';
  paymentType?: 'cash' | 'deferred';
  dueDate?: string;
  signatureUrl?: string;
  fotosAntes?: string[];
  fotosDepois?: string[];
  historico: OSStatusHistory[];
  createdAt: string;
  updatedAt: string;
  // Subcollections
  servicos?: ServiceOrderItem[];
  pecas?: PartOrderItem[];
}

export interface Vistoria {
  id: string;
  empresaId: string;
  veiculoId: string;
  clienteId: string;
  agendamentoId?: string;
  checklist: {
    item: string;
    status: 'ok' | 'not_ok' | 'na';
    notes?: string;
  }[];
  fotos: string[];
  observacoes?: string;
  tecnicoId: string;
  createdAt: string;
}

export interface Orcamento {
  id: string;
  empresaId: string;
  clienteId: string;
  veiculoId: string;
  numeroOrcamento: number;
  servicos: ServiceOrderItem[];
  pecas: PartOrderItem[];
  valorTotal: number;
  desconto: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}

export type Proposal = Orcamento;

export interface Lead {
  id: string;
  empresaId: string;
  name: string;
  email?: string;
  phone: string;
  source?: string;
  status: 'novo_lead' | 'contato_realizado' | 'aguardando_retorno' | 'orcamento_enviado' | 'negociacao' | 'convertido' | 'perdido';
  temperature: 'cold' | 'warm' | 'hot';
  notes?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  empresaId: string;
  sku?: string;
  name: string;
  quantidadeAtual: number;
  estoqueMinimo: number;
  custoMedio: number;
  precoVenda: number;
  fornecedorPadraoId?: string;
  category?: string;
}

export interface StockMovement {
  id: string;
  empresaId: string;
  itemInventarioId: string;
  tipo: 'entrada' | 'saida';
  origem: string;
  ordemServicoId?: string;
  fornecedorId?: string;
  quantidade: number;
  reason?: string;
  usuarioId: string;
  timestamp: string;
}

export interface AccountReceivable {
  id: string;
  empresaId: string;
  clienteId: string;
  ordemServicoId?: string;
  value: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
}

export interface AccountPayable {
  id: string;
  empresaId: string;
  fornecedorId?: string;
  description: string;
  value: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
}

export interface FinancialTransaction {
  id: string;
  empresaId: string;
  type: 'in' | 'out';
  value: number;
  category: string;
  description: string;
  date: string;
  relatedId?: string;
  clienteId?: string;
  fornecedorId?: string;
  status: 'pending' | 'paid' | 'cancelled';
  dueDate?: string;
  paidAt?: string;
  paymentMethod?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  empresaId: string;
  clienteId: string;
  veiculoId?: string;
  servicoIds: string[];
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
}

export interface ServiceProduct {
  itemInventarioId: string;
  name: string;
  quantidade: number;
}

export interface Service {
  id: string;
  empresaId: string;
  name: string;
  description?: string;
  price: number;
  tempoMedio?: number;
  category?: string;
  precoCusto?: number;
  produtos?: ServiceProduct[];
  createdAt: string;
  updatedAt?: any;
}

export interface Supplier {
  id: string;
  empresaId: string;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface FiscalRecord {
  id: string;
  empresaId: string;
  type: 'nfe' | 'nfse' | 'cupom';
  number: string;
  serie: string;
  value: number;
  valorImposto?: number;
  date: string;
  status: 'emitida' | 'cancelada' | 'pendente' | 'erro';
  clienteId?: string;
  fornecedorId?: string;
  direction: 'in' | 'out';
  relatedId?: string;
  observacoes?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt?: any;
}

export interface ResaleVehicle {
  id: string;
  empresaId: string;
  brand: string;
  model: string;
  year: number;
  plate?: string;
  precoCompra: number;
  precoVenda?: number;
  status: 'available' | 'reserved' | 'sold';
  km?: number;
  color?: string;
  fuel?: string;
  transmission?: string;
  createdAt: string;
  updatedAt?: any;
}

export interface DashboardMetrics {
  id: string; // YYYY-MM-DD
  empresaId: string;
  faturamentoDia: number;
  ticketMedio: number;
  osFinalizadas: number;
  novosClientes: number;
  retornoClientes: number;
  servicosMaisVendidos: { serviceId: string; name: string; count: number }[];
  pecasMaisUsadas: { itemId: string; name: string; count: number }[];
  timestamp: string;
}

export interface AuditLog {
  id: string;
  empresaId: string;
  usuarioId: string;
  acao: string;
  documento: string;
  antes?: any;
  depois?: any;
  timestamp: string;
}

export type Transaction = FinancialTransaction;
