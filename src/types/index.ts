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
  config?: any;
  createdAt: string;
}

export interface Filial {
  id: string;
  empresaId: string;
  name: string;
  address?: string;
  phone?: string;
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
  analytics: ModulePermissions;
  automations: ModulePermissions;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  empresaId: string;
  filialId?: string;
  permissions?: UserPermissions;
  status?: 'active' | 'inactive' | 'pending';
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
  | 'recepcao'
  | 'diagnostico'
  | 'orcamento' 
  | 'aguardando_aprovacao' 
  | 'aprovada' 
  | 'em_execucao' 
  | 'aguardando_peca' 
  | 'lavagem'
  | 'finalizada' 
  | 'entregue' 
  | 'pos_venda'
  | 'cancelada' 
  | 'garantia';

export interface ServiceOrderItem {
  id?: string;
  serviceId?: string;
  name: string;
  price: number;
  quantity: number;
  cost?: number;
  tecnicoId?: string;
  comissao?: number;
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

export interface OSChecklistItem {
  item: string;
  status: 'ok' | 'not_ok' | 'na';
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
  custoTotal?: number;
  lucro?: number;
  desconto: number;
  observations?: string;
  internalObservations?: string;
  paymentMethod?: 'cash' | 'pix' | 'card' | 'transfer';
  paymentType?: 'cash' | 'deferred';
  dueDate?: string;
  signatureUrl?: string;
  signatureData?: string; // Base64 signature
  fotosAntes?: string[];
  fotosDepois?: string[];
  checklist?: OSChecklistItem[];
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
  barcode?: string;
  name: string;
  description?: string;
  quantidadeAtual: number;
  quantidadeReservada: number;
  estoqueMinimo: number;
  custoMedio: number;
  precoVenda: number;
  fornecedorPadraoId?: string;
  category?: string;
  location?: string;
  unit?: string;
  abcCategory?: 'A' | 'B' | 'C';
  lastMovementAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  empresaId: string;
  itemInventarioId: string;
  tipo: 'entrada' | 'saida' | 'reserva' | 'baixa_reserva' | 'cancelamento_reserva';
  origem: 'compra' | 'venda' | 'ajuste' | 'os' | 'devolucao';
  ordemServicoId?: string;
  fornecedorId?: string;
  quantidade: number;
  custoUnitario?: number;
  precoVenda?: number;
  lote?: string;
  validade?: string;
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

export interface CostCenter {
  id: string;
  empresaId: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface MonthlyGoal {
  id: string; // YYYY-MM
  empresaId: string;
  faturamento: number;
  osCount: number;
  ticketMedio: number;
  lucroLiquido: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyClosing {
  id: string; // YYYY-MM-DD
  empresaId: string;
  date: string;
  faturamentoBruto: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  osFinalizadas: number;
  ticketMedio: number;
  usuarioId: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface RecurringTransaction {
  id: string;
  empresaId: string;
  type: 'in' | 'out';
  value: number;
  category: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfMonth?: number;
  lastGenerated?: string;
  nextOccurrence: string;
  active: boolean;
  costCenterId?: string;
  createdAt: string;
}

export interface Commission {
  id: string;
  empresaId: string;
  osId: string;
  osNumero: number;
  tecnicoId: string;
  servicoId?: string;
  servicoNome: string;
  valorServico: number;
  percentualComissao: number;
  valorComissao: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  timestamp: string;
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
  costCenterId?: string;
  status: 'pending' | 'paid' | 'cancelled';
  dueDate?: string;
  paidAt?: string;
  paymentMethod?: 'cash' | 'pix' | 'card' | 'transfer' | 'boleto';
  isRecurring?: boolean;
  recurringId?: string;
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

export interface AutomationRule {
  id: string;
  empresaId: string;
  name: string;
  type: 'revision' | 'post-sales' | 'billing' | 'birthday' | 'account-expiration' | 'quote-followup' | 'inactive-client';
  triggerDays: number; // Days before or after the event
  messageTemplate: string;
  channel: 'whatsapp' | 'email' | 'sms';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: string;
  empresaId: string;
  ruleId: string;
  clienteId: string;
  relatedId?: string; // OS ID, Orcamento ID, etc.
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
  timestamp: string;
}

export interface IntegrationConfig {
  id: string;
  empresaId: string;
  provider: 'whatsapp' | 'nfse' | 'pix' | 'mercadopago' | 'stripe';
  config: any;
  active: boolean;
  updatedAt: string;
}

export type Transaction = FinancialTransaction;
