import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Edit2,
  Trash2,
  Printer,
  ChevronRight,
  DollarSign,
  Wrench,
  User,
  Package,
  Car as CarIcon,
  Image as ImageIcon,
  Calendar,
  MessageSquare,
  Sparkles,
  Loader2,
  Minus,
  LayoutGrid,
  List as ListIcon,
  History,
  FileText,
  Search,
  Eye,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp, 
  getDoc, 
  getDocs,
  increment 
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError } from '../../utils';
import { 
  ServiceOrder, 
  Client, 
  Vehicle, 
  Service as CatalogService, 
  OSStatus, 
  ServiceOrderItem, 
  PartOrderItem,
  InventoryItem,
  OperationType,
  UserProfile
} from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency, cn, formatSafeDate } from '../../utils';
import { OSService } from '../../services/os';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import PageHeader from '../../components/layout/PageHeader';
import PageContainer from '../../components/layout/PageContainer';
import FiltersToolbar from '../../components/layout/FiltersToolbar';
import { DataTable } from '../../components/ui/DataTable';
import { AppDialog } from '../../components/ui/AppDialog';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/layout/EmptyState';
import LoadingSkeleton from '../../components/layout/LoadingSkeleton';
import { generateAIResponse } from '../../services/gemini';
import { SignatureModal } from './components/SignatureModal';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

interface ServiceOrdersProps {
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: OSStatus) => void;
  itemId?: string;
  initialStatus?: OSStatus;
}

const ServiceOrders: React.FC<ServiceOrdersProps> = ({ setActiveTab, itemId, initialStatus }) => {
  const { profile } = useAuth();
  const statusMap: Record<OSStatus, { label: string; color: string; variant: any; icon: any }> = {
    recepcao: { label: 'Recepção', color: 'bg-slate-100 text-slate-600', variant: 'secondary', icon: Clock },
    diagnostico: { label: 'Diagnóstico', color: 'bg-blue-50 text-blue-600', variant: 'info', icon: Wrench },
    orcamento: { label: 'Orçamento', color: 'bg-amber-50 text-amber-600', variant: 'warning', icon: Clock },
    aguardando_aprovacao: { label: 'Aguardando Aprovação', color: 'bg-orange-50 text-orange-600', variant: 'warning', icon: Clock },
    aprovada: { label: 'Aprovada', color: 'bg-purple-50 text-purple-600', variant: 'info', icon: CheckCircle2 },
    em_execucao: { label: 'Em Execução', color: 'bg-blue-50 text-blue-600', variant: 'info', icon: Wrench },
    aguardando_peca: { label: 'Aguardando Peça', color: 'bg-yellow-50 text-yellow-600', variant: 'warning', icon: Clock },
    lavagem: { label: 'Lavagem', color: 'bg-cyan-50 text-cyan-600', variant: 'info', icon: Wrench },
    finalizada: { label: 'Finalizada', color: 'bg-green-50 text-green-600', variant: 'success', icon: CheckCircle2 },
    entregue: { label: 'Entregue', color: 'bg-emerald-50 text-emerald-600', variant: 'success', icon: CheckCircle2 },
    pos_venda: { label: 'Pós-venda', color: 'bg-indigo-50 text-indigo-600', variant: 'info', icon: MessageSquare },
    cancelada: { label: 'Cancelada', color: 'bg-red-50 text-red-600', variant: 'danger', icon: XCircle },
    garantia: { label: 'Garantia', color: 'bg-rose-50 text-rose-600', variant: 'danger', icon: AlertCircle },
  };
  const [osList, setOsList] = useState<ServiceOrder[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [osToDelete, setOsToDelete] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'checklist' | 'photos' | 'signature' | 'timeline'>('details');
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [editingOS, setEditingOS] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [partSearchTerm, setPartSearchTerm] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const { canCreate, canEdit, canDelete } = usePermissions('os');

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [formData, setFormData] = useState({
    clienteId: '',
    veiculoId: '',
    status: 'orcamento' as OSStatus,
    selectedServices: [] as ServiceOrderItem[],
    selectedParts: [] as PartOrderItem[],
    desconto: 0,
    observations: '',
    internalObservations: '',
    paymentMethod: 'pix' as 'cash' | 'pix' | 'card' | 'transfer',
    paymentType: 'cash' as 'cash' | 'deferred',
    dueDate: formatSafeDate(addDays(new Date(), 30), 'yyyy-MM-dd'),
    checklist: [] as { item: string; status: 'ok' | 'not_ok' | 'na'; notes?: string }[],
    fotosAntes: [] as string[],
    fotosDepois: [] as string[],
    signatureData: ''
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const qOS = query(
      collection(db, 'ordens_servico'), 
      where('empresaId', '==', profile.empresaId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOS = onSnapshot(qOS, (snapshot) => {
      const list: ServiceOrder[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ServiceOrder);
      });
      setOsList(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'ordens_servico');
      setLoading(false);
    });

    const qClients = query(
      collection(db, 'clientes'),
      where('empresaId', '==', profile.empresaId)
    );
    const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
      const list: Client[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Client));
      setClients(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'clientes');
    });

    const qVehicles = query(
      collection(db, 'veiculos'),
      where('empresaId', '==', profile.empresaId)
    );
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      const list: Vehicle[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'veiculos');
    });

    const qServices = query(
      collection(db, 'catalogo_servicos'),
      where('empresaId', '==', profile.empresaId)
    );
    const unsubscribeServices = onSnapshot(qServices, (snapshot) => {
      const list: CatalogService[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as CatalogService));
      setServices(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'catalogo_servicos');
    });

    const qInventory = query(
      collection(db, 'inventario'),
      where('empresaId', '==', profile.empresaId)
    );
    const unsubscribeInventory = onSnapshot(qInventory, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'inventario');
    });

    const qUsers = query(
      collection(db, 'usuarios'),
      where('empresaId', '==', profile.empresaId)
    );
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => list.push({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'usuarios');
    });

    return () => {
      unsubscribeOS();
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeServices();
      unsubscribeInventory();
      unsubscribeUsers();
    };
  }, [profile]);

  useEffect(() => {
    const fetchOSDetails = async () => {
      if (itemId && osList.length > 0) {
        const os = osList.find(o => o.id === itemId);
        if (os) {
          // Fetch services and parts from subcollections
          const servicesSnap = await getDocs(collection(db, 'ordens_servico', os.id, 'servicos'));
          const partsSnap = await getDocs(collection(db, 'ordens_servico', os.id, 'pecas'));
          
          const osServices = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceOrderItem));
          const osParts = partsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PartOrderItem));

          setEditingOS({ ...os, servicos: osServices, pecas: osParts });
          setFormData({
            clienteId: os.clienteId,
            veiculoId: os.veiculoId,
            status: initialStatus || os.status,
            selectedServices: osServices,
            selectedParts: osParts,
            desconto: os.desconto || 0,
            observations: os.observations || '',
            internalObservations: os.internalObservations || '',
            paymentMethod: os.paymentMethod || 'pix',
            paymentType: os.paymentType || 'cash',
            dueDate: os.dueDate || formatSafeDate(addDays(new Date(), 30), 'yyyy-MM-dd'),
            checklist: os.checklist || [],
            fotosAntes: os.fotosAntes || [],
            fotosDepois: os.fotosDepois || [],
            signatureData: os.signatureData || ''
          });
          setIsModalOpen(true);
          setSearchTerm(''); // Clear search when opening specific item
        } else {
          setSearchTerm(itemId);
        }
      } else if (!itemId) {
        setSearchTerm('');
      }
    };

    fetchOSDetails();
  }, [itemId, osList, initialStatus]);

  const calculateTotal = () => {
    const servicesTotal = formData.selectedServices.reduce((acc, s) => acc + (s.price * s.quantity), 0);
    const partsTotal = formData.selectedParts.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    return Math.max(0, servicesTotal + partsTotal - formData.desconto);
  };

  const calculateTotalCost = () => {
    const servicesCost = formData.selectedServices.reduce((acc, s) => acc + ((s.cost || 0) * s.quantity), 0);
    const partsCost = formData.selectedParts.reduce((acc, p) => acc + ((p.cost || 0) * p.quantity), 0);
    return servicesCost + partsCost;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clienteId || !formData.veiculoId || (formData.selectedServices.length === 0 && formData.selectedParts.length === 0)) {
      toast.error('Cliente, veículo e pelo menos um item são obrigatórios.');
      return;
    }

    try {
      const valorTotal = calculateTotal();
      const totalCost = calculateTotalCost();
      
      if (editingOS) {
        if (editingOS.status === 'finalizada' || editingOS.status === 'entregue') {
          toast.error('Ordens de serviço finalizadas não podem ser editadas.');
          return;
        }

        // Update OS using service
        await OSService.updateOS(editingOS.id, profile!.empresaId, {
          clienteId: formData.clienteId,
          veiculoId: formData.veiculoId,
          status: formData.status,
          servicos: formData.selectedServices,
          pecas: formData.selectedParts,
          desconto: formData.desconto,
          valorTotal,
          custoTotal: totalCost,
          lucro: valorTotal - totalCost,
          observations: formData.observations,
          internalObservations: formData.internalObservations,
          paymentMethod: formData.paymentMethod,
          paymentType: formData.paymentType,
          dueDate: formData.dueDate,
          checklist: formData.checklist,
          fotosAntes: formData.fotosAntes,
          fotosDepois: formData.fotosDepois,
          signatureData: formData.signatureData
        });
        
        toast.success('OS atualizada com sucesso!');
      } else {
        const osId = await OSService.createOS(profile!.empresaId, {
          clienteId: formData.clienteId,
          veiculoId: formData.veiculoId,
          status: formData.status,
          servicos: formData.selectedServices,
          pecas: formData.selectedParts,
          desconto: formData.desconto,
          valorTotal,
          custoTotal: totalCost,
          lucro: valorTotal - totalCost,
          observations: formData.observations,
          internalObservations: formData.internalObservations,
          paymentMethod: formData.paymentMethod,
          paymentType: formData.paymentType,
          dueDate: formData.dueDate,
          checklist: formData.checklist,
          fotosAntes: formData.fotosAntes,
          fotosDepois: formData.fotosDepois,
          signatureData: formData.signatureData
        });

        if (osId) toast.success('OS criada com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar OS.');
    }
  };

  const handleDelete = async (id: string) => {
    setOsToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!osToDelete) return;
    try {
      await deleteDoc(doc(db, 'ordens_servico', osToDelete));
      toast.success('OS excluída com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir OS.');
    } finally {
      setOsToDelete(null);
    }
  };

  const openModal = async (os?: ServiceOrder) => {
    if (os) {
      const servicesSnap = await getDocs(collection(db, 'ordens_servico', os.id, 'servicos'));
      const partsSnap = await getDocs(collection(db, 'ordens_servico', os.id, 'pecas'));
      
      const osServices = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceOrderItem));
      const osParts = partsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PartOrderItem));

      setEditingOS({ ...os, servicos: osServices, pecas: osParts });
      setFormData({
        clienteId: os.clienteId,
        veiculoId: os.veiculoId,
        status: os.status,
        selectedServices: osServices,
        selectedParts: osParts,
        desconto: os.desconto || 0,
        observations: os.observations || '',
        internalObservations: os.internalObservations || '',
        paymentMethod: os.paymentMethod || 'pix',
        paymentType: os.paymentType || 'cash',
        dueDate: os.dueDate || formatSafeDate(addDays(new Date(), 30), 'yyyy-MM-dd'),
        checklist: os.checklist || [],
        fotosAntes: os.fotosAntes || [],
        fotosDepois: os.fotosDepois || [],
        signatureData: os.signatureData || ''
      });
    } else {
      setEditingOS(null);
      setFormData({
        clienteId: '',
        veiculoId: '',
        status: 'orcamento',
        selectedServices: [],
        selectedParts: [],
        desconto: 0,
        observations: '',
        internalObservations: '',
        paymentMethod: 'pix',
        paymentType: 'cash',
        dueDate: formatSafeDate(addDays(new Date(), 30), 'yyyy-MM-dd'),
        checklist: [
          { item: 'Nível de Óleo', status: 'na' },
          { item: 'Líquido de Arrefecimento', status: 'na' },
          { item: 'Pneus', status: 'na' },
          { item: 'Freios', status: 'na' },
          { item: 'Luzes', status: 'na' },
          { item: 'Suspensão', status: 'na' }
        ],
        fotosAntes: [],
        fotosDepois: [],
        signatureData: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOS(null);
    setServiceSearchTerm('');
    // Clear the itemId in the parent state to prevent re-opening
    if (itemId) {
      setActiveTab('os', undefined);
    }
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Desconhecido';
  const getVehicleInfo = (id: string) => {
    const v = vehicles.find(v => v.id === id);
    return v ? `${v.brand} ${v.model} (${v.plate})` : 'Desconhecido';
  };

  const sendNotification = async (os: Partial<ServiceOrder> & { id: string }) => {
    const client = clients.find(c => c.id === os.clienteId);
    const vehicle = vehicles.find(v => v.id === os.veiculoId);
    
    if (!client || !client.phone) {
      toast.error('Cliente não possui telefone cadastrado.');
      return;
    }

    const message = `Olá ${client.name}! O serviço no seu veículo ${vehicle?.brand} ${vehicle?.model} (${vehicle?.plate}) foi concluído. O valor total é ${formatCurrency(os.valorTotal || 0)}. Já pode vir buscar!`;
    
    // In a real app, you'd call an API here (SMS, Email, WhatsApp API)
    // For this demo, we'll open a WhatsApp link and show a toast
    const whatsappUrl = `https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    
    try {
      window.open(whatsappUrl, '_blank');
      await updateDoc(doc(db, 'ordens_servico', os.id), {
        notificationSent: true,
        updatedAt: serverTimestamp()
      });
      toast.success('Notificação enviada!');
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      toast.error('Erro ao registrar envio de notificação.');
    }
  };

  const deductInventory = async (services: ServiceOrderItem[]) => {
    try {
      for (const service of services) {
        if (service.produtos) {
          for (const product of service.produtos) {
            const productRef = doc(db, 'inventario', product.itemInventarioId);
            
            // 1. Update inventory quantity
            await updateDoc(productRef, {
              quantidadeAtual: increment(-product.quantidade)
            });

            // 2. Create stock movement record
            await addDoc(collection(db, 'movimentacoes_estoque'), {
              empresaId: profile?.empresaId,
              itemInventarioId: product.itemInventarioId,
              tipo: 'saida',
              quantidade: product.quantidade,
              reason: `OS #${editingOS?.id?.slice(0, 6) || 'Nova'} - ${service.name}`,
              timestamp: new Date().toISOString(),
              usuarioId: auth.currentUser?.uid,
              origem: 'os'
            });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao dar baixa no estoque:', error);
      toast.error('Erro ao dar baixa no estoque.');
    }
  };

  const addServiceToOS = (service: CatalogService) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: [...prev.selectedServices, { 
        id: service.id, 
        name: service.name, 
        price: service.price,
        quantity: 1,
        cost: service.precoCusto || 0,
        tecnicoId: auth.currentUser?.uid || '',
        comissao: 0,
        produtos: service.produtos || []
      }]
    }));
  };

  const removeServiceFromOS = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.filter((_, i) => i !== index)
    }));
  };

  const addPartToOS = (item: InventoryItem) => {
    setFormData(prev => ({
      ...prev,
      selectedParts: [...prev.selectedParts, { 
        id: item.id, 
        name: item.name, 
        price: item.precoVenda,
        quantity: 1,
        cost: item.custoMedio,
        itemId: item.id
      }]
    }));
  };

  const removePartFromOS = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectedParts: prev.selectedParts.filter((_, i) => i !== index)
    }));
  };

  const filteredOS = osList.filter(os => 
    getClientName(os.clienteId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getVehicleInfo(os.veiculoId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    os.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateAIObservations = async () => {
    if (formData.selectedServices.length === 0) {
      toast.error('Selecione pelo menos um serviço para gerar observações.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const client = clients.find(c => c.id === formData.clienteId);
      const vehicle = vehicles.find(v => v.id === formData.veiculoId);
      const servicesList = formData.selectedServices.map(s => s.name).join(', ');
      
      const prompt = `
        Gere uma observação técnica e profissional para uma Ordem de Serviço.
        Cliente: ${client?.name || 'N/A'}
        Veículo: ${vehicle?.brand} ${vehicle?.model} (${vehicle?.plate})
        Serviços realizados: ${servicesList}
        
        O texto deve ser conciso, focar no que foi feito e passar confiança ao cliente.
        Não use saudações, vá direto ao ponto técnico.
      `;

      const aiResponse = await generateAIResponse(prompt, 'Ordens de Serviço');
      setFormData(prev => ({ ...prev, observations: aiResponse || prev.observations }));
      toast.success('Observações geradas com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar observações com IA.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleUpdateStatus = async (os: ServiceOrder, newStatus: OSStatus) => {
    if (newStatus === 'finalizada' || newStatus === 'aprovada') {
      // Fetch details first to ensure we have services and parts
      const servicesSnap = await getDocs(collection(db, 'ordens_servico', os.id, 'servicos'));
      const partsSnap = await getDocs(collection(db, 'ordens_servico', os.id, 'pecas'));
      
      const osServices = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceOrderItem));
      const osParts = partsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PartOrderItem));

      setEditingOS({ ...os, servicos: osServices, pecas: osParts });
      setFormData({
        clienteId: os.clienteId,
        veiculoId: os.veiculoId,
        status: newStatus,
        selectedServices: osServices,
        selectedParts: osParts,
        desconto: os.desconto || 0,
        observations: os.observations || '',
        internalObservations: os.internalObservations || '',
        paymentMethod: os.paymentMethod || 'pix',
        paymentType: os.paymentType || 'cash',
        dueDate: os.dueDate || formatSafeDate(addDays(new Date(), 30), 'yyyy-MM-dd'),
        checklist: os.checklist || [],
        fotosAntes: os.fotosAntes || [],
        fotosDepois: os.fotosDepois || [],
        signatureData: os.signatureData || ''
      });
      setIsModalOpen(true);
      return;
    }

    try {
      if (os.status === 'finalizada' || os.status === 'entregue') {
        toast.error('Ordens de serviço finalizadas não podem ser alteradas.');
        return;
      }

      await OSService.updateStatus(os.id, profile!.empresaId, newStatus, auth.currentUser?.uid || '');

      toast.success(`Status da OS alterado para ${statusMap[newStatus].label}`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar status da OS.');
    }
  };

  const KanbanBoard = () => {
    const columns: OSStatus[] = ['orcamento', 'aguardando_aprovacao', 'aprovada', 'em_execucao', 'aguardando_peca', 'finalizada'];
    
    return (
      <div className="flex gap-6 overflow-x-auto pb-8 min-h-[600px] custom-scrollbar">
        {columns.map(status => (
          <div key={status} className="flex-shrink-0 w-80 flex flex-col gap-4">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", statusMap[status].color.split(' ')[0].replace('bg-', 'bg-').replace('-50', '-500'))} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{statusMap[status].label}</span>
              </div>
              <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                {filteredOS.filter(os => os.status === status).length}
              </span>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              {filteredOS.filter(os => os.status === status).map(os => (
                <motion.div
                  layout
                  key={os.id}
                  onClick={() => openModal(os)}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-accent/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold text-slate-400">#{os.numeroOS || os.id.slice(0, 6).toUpperCase()}</span>
                    <span className="text-xs font-black text-slate-900 font-display">{formatCurrency(os.valorTotal)}</span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mb-2 group-hover:text-primary transition-colors">{getClientName(os.clienteId)}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                    <CarIcon size={12} className="text-slate-300" />
                    {getVehicleInfo(os.veiculoId)}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-400">
                        {getClientName(os.clienteId).slice(0, 1)}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">{formatSafeDate(os.createdAt, 'dd/MM')}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader 
        title="Ordens de Serviço" 
        subtitle="Gerencie e acompanhe todos os serviços da sua oficina."
        breadcrumbs={[{ label: 'Ordens de Serviço' }]}
        actions={
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  viewMode === 'list' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Lista
              </button>
              <button 
                onClick={() => setViewMode('kanban')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  viewMode === 'kanban' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Kanban
              </button>
            </div>
            {canCreate && (
              <AppButton onClick={() => openModal()} variant="primary" icon={<Plus size={18} />}>
                Nova Ordem
              </AppButton>
            )}
          </div>
        }
      />

      <FiltersToolbar 
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por cliente, veículo ou número da OS..."
      />

      {/* OS List / Kanban */}
      <div className="mt-6">
        {loading ? (
          <LoadingSkeleton variant="table" count={5} />
        ) : filteredOS.length > 0 ? (
          viewMode === 'list' ? (
            <DataTable
              data={filteredOS}
              columns={[
                {
                  header: 'OS / Data',
                  accessor: (os) => (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">#{os.numeroOS || os.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-xs text-slate-500">
                        {formatSafeDate(os.createdAt, 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )
                },
                {
                  header: 'Cliente / Veículo',
                  accessor: (os) => (
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{getClientName(os.clienteId)}</span>
                      <span className="text-xs text-slate-500">{getVehicleInfo(os.veiculoId)}</span>
                    </div>
                  )
                },
                {
                  header: 'Status',
                  accessor: (os) => {
                    const status = statusMap[os.status];
                    return (
                      <StatusBadge 
                        status={os.status}
                        label={status.label}
                        variant={status.variant}
                        icon={status.icon}
                      />
                    );
                  }
                },
                {
                  header: 'Total',
                  accessor: (os) => (
                    <span className="font-bold text-slate-900">{formatCurrency(os.valorTotal)}</span>
                  ),
                  className: 'text-right'
                },
                {
                  header: 'Ações',
                  accessor: (os) => (
                    <div className="flex items-center justify-end gap-2">
                      <AppButton 
                        onClick={() => openModal(os)}
                        variant="ghost"
                        size="sm"
                        icon={<Edit2 size={16} />}
                        title="Editar"
                      />
                      <AppButton 
                        variant="ghost"
                        size="sm"
                        icon={<Printer size={16} />}
                        title="Imprimir"
                      />
                      <AppButton 
                        variant="ghost"
                        size="sm"
                        icon={<Send size={16} />}
                        onClick={() => sendNotification(os)}
                        title="Enviar WhatsApp"
                      />
                      {canDelete && (
                        <AppButton 
                          onClick={() => handleDelete(os.id)}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={16} />}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Excluir"
                        />
                      )}
                    </div>
                  ),
                  className: 'text-right'
                }
              ]}
            />
          ) : (
            <KanbanBoard />
          )
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma ordem de serviço encontrada"
            description={searchTerm ? "Tente ajustar sua busca para encontrar o que procura." : "Comece criando sua primeira ordem de serviço para gerenciar seus atendimentos."}
            action={!searchTerm ? (
              <AppButton onClick={() => openModal()} variant="primary" icon={<Plus size={18} />}>
                Nova Ordem
              </AppButton>
            ) : undefined}
          />
        )}
      </div>

      <AppDialog
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingOS ? `Editar OS #${editingOS.numeroOS || editingOS.id.slice(0, 8).toUpperCase()}` : 'Nova Ordem de Serviço'}
        maxWidth="7xl"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-6">
            <div className="flex items-center gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Subtotal</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(calculateTotal() + formData.desconto)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Desconto</p>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="number"
                    className="bg-slate-100 border-slate-200 rounded-xl pl-8 pr-3 py-1.5 w-28 text-sm font-bold focus:ring-2 focus:ring-primary transition-all"
                    value={formData.desconto}
                    onChange={(e) => setFormData({ ...formData, desconto: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Total Final</p>
                <p className="text-3xl font-black font-display tracking-tighter text-slate-900">{formatCurrency(calculateTotal())}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <AppButton 
                type="button"
                variant="ghost"
                onClick={closeModal}
              >
                Descartar
              </AppButton>
              <AppButton 
                type="submit"
                form="os-form"
                variant="primary"
                className="!px-12"
                icon={<CheckCircle2 size={20} />}
              >
                {editingOS ? 'Salvar Alterações' : 'Emitir Ordem de Serviço'}
              </AppButton>
            </div>
          </div>
        }
      >
        <form id="os-form" onSubmit={handleSubmit} className="relative flex flex-col">
          {/* Tab Navigation */}
          <div className="py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
              {[
                { id: 'details', label: 'Detalhes', icon: FileText },
                { id: 'checklist', label: 'Checklist', icon: ClipboardList },
                { id: 'photos', label: 'Fotos', icon: ImageIcon },
                { id: 'signature', label: 'Assinatura', icon: Edit2 },
                { id: 'timeline', label: 'Linha do Tempo', icon: History },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveModalTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap relative",
                    activeModalTab === tab.id 
                      ? "bg-white text-primary shadow-xl shadow-primary/5 border border-primary/10" 
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <tab.icon size={16} />
                  {tab.label}
                  {activeModalTab === tab.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute -bottom-[17px] left-0 right-0 h-1 bg-primary rounded-t-full"
                    />
                  )}
                </button>
              ))}
            </div>
            
            {editingOS && (
              <button
                type="button"
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                <Printer size={16} />
                Imprimir OS
              </button>
            )}
          </div>

          <div className="flex-1 p-8 sm:p-12 space-y-12">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeModalTab}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeModalTab === 'details' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      {/* Left Column: Client & Vehicle */}
                      <div className="space-y-10">
                        <div className="space-y-6">
                          <div className="flex items-center gap-3 text-primary">
                            <User size={20} />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em]">Cliente & Veículo</h3>
                          </div>
                          
                          <div className="space-y-4">
                            <SearchableSelect 
                              label="Cliente"
                              placeholder="Selecione um cliente"
                              options={clients.map(c => ({ id: c.id, label: c.name, subLabel: c.phone }))}
                              value={formData.clienteId}
                              onChange={(val) => setFormData({ ...formData, clienteId: val, veiculoId: '' })}
                              required
                            />

                            <SearchableSelect 
                              label="Veículo"
                              placeholder="Selecione um veículo"
                              options={vehicles
                                .filter(v => v.clienteId === formData.clienteId)
                                .map(v => ({ id: v.id, label: `${v.brand} ${v.model}`, subLabel: v.plate }))
                              }
                              value={formData.veiculoId}
                              onChange={(val) => setFormData({ ...formData, veiculoId: val })}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="flex items-center gap-3 text-primary">
                            <Clock size={20} />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em]">Status & Pagamento</h3>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                              <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as OSStatus })}
                              >
                                {Object.entries(statusMap).map(([key, value]) => (
                                  <option key={key} value={key}>{value.label}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Pagamento</label>
                              <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                value={formData.paymentType}
                                onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as any })}
                              >
                                <option value="cash">À Vista</option>
                                <option value="deferred">A Prazo (Faturado)</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                              <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                value={formData.paymentMethod}
                                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                              >
                                <option value="pix">PIX</option>
                                <option value="cash">Dinheiro</option>
                                <option value="card">Cartão</option>
                                <option value="transfer">Transferência</option>
                              </select>
                            </div>

                            {formData.paymentType === 'deferred' && (
                              <AppInput 
                                label="Data de Vencimento"
                                type="date"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Services */}
                      <div className="space-y-10">
                        <div className="space-y-6">
                          <div className="flex items-center gap-3 text-primary">
                            <Wrench size={20} />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em]">Serviços & Peças</h3>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                              <input 
                                type="text" 
                                placeholder="Buscar serviços..." 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                value={serviceSearchTerm}
                                onChange={(e) => setServiceSearchTerm(e.target.value)}
                              />
                              {serviceSearchTerm && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 max-h-60 overflow-y-auto p-2">
                                  {services
                                    .filter(s => s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()))
                                    .map(s => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                          addServiceToOS(s);
                                          setServiceSearchTerm('');
                                        }}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors text-left group"
                                      >
                                        <div>
                                          <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{s.name}</p>
                                          <p className="text-xs text-slate-400 font-medium">{formatCurrency(s.price)}</p>
                                        </div>
                                        <Plus size={18} className="text-slate-300 group-hover:text-primary" />
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>

                            <div className="relative">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                              <input 
                                type="text" 
                                placeholder="Buscar peças..." 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                value={partSearchTerm}
                                onChange={(e) => setPartSearchTerm(e.target.value)}
                              />
                              {partSearchTerm && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 max-h-60 overflow-y-auto p-2">
                                  {inventory
                                    .filter(p => p.name.toLowerCase().includes(partSearchTerm.toLowerCase()))
                                    .map(p => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                          addPartToOS(p);
                                          setPartSearchTerm('');
                                        }}
                                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors text-left group"
                                      >
                                        <div>
                                          <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{p.name}</p>
                                          <p className="text-xs text-slate-400 font-medium">{formatCurrency(p.precoVenda)} - Estoque: {p.quantidadeAtual}</p>
                                        </div>
                                        <Plus size={18} className="text-slate-300 group-hover:text-primary" />
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              {formData.selectedServices.map((s, i) => (
                                <div key={`service-${i}`} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:border-primary/20 transition-all">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</span>
                                      <p className="font-bold text-slate-900">{s.name}</p>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1">
                                      <span className="text-xs font-black text-primary">{formatCurrency(s.price)}</span>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const newServices = [...formData.selectedServices];
                                            newServices[i].quantity = Math.max(1, newServices[i].quantity - 1);
                                            setFormData({ ...formData, selectedServices: newServices });
                                          }}
                                          className="p-1 hover:bg-slate-100 rounded-lg"
                                        >
                                          <Minus size={12} />
                                        </button>
                                        <span className="text-xs font-bold text-slate-600">{s.quantity}</span>
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const newServices = [...formData.selectedServices];
                                            newServices[i].quantity += 1;
                                            setFormData({ ...formData, selectedServices: newServices });
                                          }}
                                          className="p-1 hover:bg-slate-100 rounded-lg"
                                        >
                                          <Plus size={12} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 mt-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico</span>
                                        <select
                                          className="bg-white border border-slate-200 rounded-lg text-[10px] font-bold px-2 py-1 outline-none focus:ring-2 focus:ring-primary transition-all"
                                          value={s.tecnicoId}
                                          onChange={(e) => {
                                            const newServices = [...formData.selectedServices];
                                            newServices[i].tecnicoId = e.target.value;
                                            setFormData({ ...formData, selectedServices: newServices });
                                          }}
                                        >
                                          <option value="">Selecione...</option>
                                          {users.map(u => (
                                            <option key={u.uid} value={u.uid}>{u.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comissão (%)</span>
                                        <input
                                          type="number"
                                          className="w-16 bg-white border border-slate-200 rounded-lg text-[10px] font-bold px-2 py-1 outline-none focus:ring-2 focus:ring-primary transition-all"
                                          value={s.comissao}
                                          onChange={(e) => {
                                            const newServices = [...formData.selectedServices];
                                            newServices[i].comissao = Number(e.target.value);
                                            setFormData({ ...formData, selectedServices: newServices });
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => removeServiceFromOS(i)}
                                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              ))}

                              {formData.selectedParts.map((p, i) => (
                                <div key={`part-${i}`} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:border-primary/20 transition-all">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peça</span>
                                      <p className="font-bold text-slate-900">{p.name}</p>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1">
                                      <span className="text-xs font-black text-primary">{formatCurrency(p.price)}</span>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const newParts = [...formData.selectedParts];
                                            newParts[i].quantity = Math.max(1, newParts[i].quantity - 1);
                                            setFormData({ ...formData, selectedParts: newParts });
                                          }}
                                          className="p-1 hover:bg-slate-100 rounded-lg"
                                        >
                                          <Minus size={12} />
                                        </button>
                                        <span className="text-xs font-bold text-slate-600">{p.quantity}</span>
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const newParts = [...formData.selectedParts];
                                            newParts[i].quantity += 1;
                                            setFormData({ ...formData, selectedParts: newParts });
                                          }}
                                          className="p-1 hover:bg-slate-100 rounded-lg"
                                        >
                                          <Plus size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => removePartFromOS(i)}
                                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              ))}

                              {formData.selectedServices.length === 0 && formData.selectedParts.length === 0 && (
                                <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                                  <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Nenhum item selecionado</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-primary">
                              <MessageSquare size={20} />
                              <h3 className="text-sm font-black uppercase tracking-[0.2em]">Observações</h3>
                            </div>
                            <button
                              type="button"
                              onClick={handleGenerateAIObservations}
                              disabled={isGeneratingAI}
                              className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/5 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                            >
                              {isGeneratingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                              Gerar com IA
                            </button>
                          </div>
                          <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none min-h-[120px]"
                            placeholder="Detalhes técnicos, recomendações ou observações gerais..."
                            value={formData.observations}
                            onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                          />
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações Internas (Não visível ao cliente)</label>
                            <textarea
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none min-h-[100px]"
                              placeholder="Notas para a equipe técnica, histórico interno..."
                              value={formData.internalObservations}
                              onChange={(e) => setFormData({ ...formData, internalObservations: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeModalTab === 'checklist' && (
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 text-primary">
                        <ClipboardList size={24} />
                        <h3 className="text-lg font-black uppercase tracking-[0.2em]">Checklist de Entrada</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {formData.checklist.map((item, i) => (
                          <div key={i} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between gap-4 group hover:bg-white hover:shadow-xl transition-all">
                            <span className="text-sm font-bold text-slate-700">{item.item}</span>
                            <div className="flex items-center gap-2">
                              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                                {(['ok', 'not_ok', 'na'] as const).map((status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => {
                                      const newChecklist = [...formData.checklist];
                                      newChecklist[i].status = status;
                                      setFormData({ ...formData, checklist: newChecklist });
                                    }}
                                    className={cn(
                                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all",
                                      item.status === status 
                                        ? status === 'ok' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : status === 'not_ok' ? "bg-rose-500 text-white shadow-lg shadow-rose-200" : "bg-slate-500 text-white shadow-lg shadow-slate-200"
                                        : "text-slate-400 hover:text-slate-600"
                                    )}
                                  >
                                    {status === 'ok' ? 'OK' : status === 'not_ok' ? 'X' : '-'}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newChecklist = formData.checklist.filter((_, idx) => idx !== i);
                                  setFormData({ ...formData, checklist: newChecklist });
                                }}
                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 mt-8">
                        <input 
                          type="text"
                          placeholder="Novo item de inspeção..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const target = e.target as HTMLInputElement;
                              if (target.value.trim()) {
                                setFormData({
                                  ...formData,
                                  checklist: [...formData.checklist, { item: target.value.trim(), status: 'na' }]
                                });
                                target.value = '';
                              }
                            }
                          }}
                        />
                        <AppButton
                          type="button"
                          onClick={(e) => {
                            const input = (e.currentTarget.previousSibling as HTMLInputElement);
                            if (input.value.trim()) {
                              setFormData({
                                ...formData,
                                checklist: [...formData.checklist, { item: input.value.trim(), status: 'na' }]
                              });
                              input.value = '';
                            }
                          }}
                          variant="primary"
                        >
                          Adicionar Item
                        </AppButton>
                      </div>
                    </div>
                  )}

                  {activeModalTab === 'photos' && (
                    <div className="space-y-12">
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 text-primary">
                          <ImageIcon size={24} />
                          <h3 className="text-lg font-black uppercase tracking-widest">Galeria de Fotos</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fotos Antes</p>
                            <div className="grid grid-cols-3 gap-4">
                              {formData.fotosAntes.map((foto, i) => (
                                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group">
                                  <img src={foto} alt={`Foto ${i}`} className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, fotosAntes: formData.fotosAntes.filter((_, idx) => idx !== i) })}
                                    className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                              <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-slate-400 hover:text-primary">
                                <Plus size={24} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Adicionar</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setFormData({ ...formData, fotosAntes: [...formData.fotosAntes, reader.result as string] });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fotos Depois</p>
                            <div className="grid grid-cols-3 gap-4">
                              {formData.fotosDepois.map((foto, i) => (
                                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group">
                                  <img src={foto} alt={`Foto ${i}`} className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, fotosDepois: formData.fotosDepois.filter((_, idx) => idx !== i) })}
                                    className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                              <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-slate-400 hover:text-primary">
                                <Plus size={24} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Adicionar</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setFormData({ ...formData, fotosDepois: [...formData.fotosDepois, reader.result as string] });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeModalTab === 'signature' && (
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 text-primary">
                        <Edit2 size={24} />
                        <h3 className="text-lg font-black uppercase tracking-widest">Assinatura do Cliente</h3>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-12 relative group min-h-[400px] flex flex-col items-center justify-center">
                        {formData.signatureData ? (
                          <div className="relative w-full max-w-md aspect-[2/1] bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-2xl">
                            <img src={formData.signatureData} alt="Assinatura" className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, signatureData: '' })}
                              className="absolute top-4 right-4 p-3 bg-rose-500 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-8 text-slate-400">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-200 border border-slate-100 shadow-sm">
                              <Sparkles size={48} />
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-slate-900">Aguardando Assinatura</p>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">O cliente deve assinar para validar a OS</p>
                            </div>
                            <AppButton
                              type="button"
                              onClick={() => setIsSignatureModalOpen(true)}
                              variant="primary"
                              className="!px-12 !py-4"
                            >
                              Assinar Agora
                            </AppButton>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {activeModalTab === 'timeline' && (
                    <div className="space-y-8">
                      <div className="flex items-center gap-3 text-primary">
                        <Clock size={24} />
                        <h3 className="text-lg font-black uppercase tracking-widest">Linha do Tempo</h3>
                      </div>

                      <div className="space-y-8 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {(editingOS?.historico || []).length > 0 ? (
                          editingOS?.historico.map((step, idx) => (
                            <div key={idx} className="relative pl-16 group">
                              <div className={cn(
                                "absolute left-0 top-0 w-12 h-12 rounded-2xl border-4 border-white flex items-center justify-center z-10 transition-all duration-500 shadow-lg",
                                statusMap[step.status]?.color.replace('text-', 'bg-').replace('50', '500')
                              )}>
                                <div className="w-2.5 h-2.5 bg-white rounded-full" />
                              </div>
                              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 group-hover:bg-white group-hover:shadow-2xl group-hover:shadow-slate-100 transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                  <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl w-fit",
                                    statusMap[step.status]?.color.replace('text-', 'bg-').replace('500', '100'),
                                    statusMap[step.status]?.color
                                  )}>
                                    {statusMap[step.status]?.label}
                                  </span>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {formatSafeDate(step.timestamp, "dd/MM/yyyy 'às' HH:mm")}
                                  </span>
                                </div>
                                <p className="text-base font-bold text-slate-900 leading-relaxed">{step.notes}</p>
                                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                                    <User size={16} />
                                  </div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Operador: <span className="text-slate-900">{users.find(u => u.uid === step.usuarioId)?.name || 'Sistema'}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-20 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                            <History size={48} className="text-slate-200 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum histórico disponível</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </form>
        </AppDialog>

      <SignatureModal 
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={(data) => setFormData({ ...formData, signatureData: data })}
      />

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Ordem de Serviço?"
        message="Tem certeza que deseja excluir esta OS? Esta ação não pode ser desfeita."
      />
    </PageContainer>
  );
};

export default ServiceOrders;

