import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  MoreVertical,
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
  List as ListIcon
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
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  ServiceOrder, 
  Client, 
  Vehicle, 
  Service as CatalogService, 
  OSStatus, 
  ServiceOrderItem, 
  PartOrderItem,
  InventoryItem
} from '../types';
import { useAuth } from './Auth';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, cn } from '../lib/utils';
import { OSService } from '../services/os';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmationModal } from './ConfirmationModal';
import { generateAIResponse } from '../services/gemini';

interface ServiceOrdersProps {
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: OSStatus) => void;
  itemId?: string;
  initialStatus?: OSStatus;
}

const ServiceOrders: React.FC<ServiceOrdersProps> = ({ setActiveTab, itemId, initialStatus }) => {
  const { profile } = useAuth();
  const statusMap = {
    orcamento: { label: 'Orçamento', color: 'bg-zinc-100 text-zinc-600', icon: Clock },
    aguardando_aprovacao: { label: 'Aguardando', color: 'bg-orange-50 text-orange-600', icon: Clock },
    aprovada: { label: 'Aprovada', color: 'bg-purple-50 text-purple-600', icon: CheckCircle2 },
    em_execucao: { label: 'Em Execução', color: 'bg-blue-50 text-blue-600', icon: Wrench },
    aguardando_peca: { label: 'Aguardando Peça', color: 'bg-yellow-50 text-yellow-600', icon: Clock },
    finalizada: { label: 'Finalizada', color: 'bg-green-50 text-green-600', icon: CheckCircle2 },
    entregue: { label: 'Entregue', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
    cancelada: { label: 'Cancelada', color: 'bg-red-50 text-red-600', icon: XCircle },
    garantia: { label: 'Garantia', color: 'bg-indigo-50 text-indigo-600', icon: AlertCircle },
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
  const [editingOS, setEditingOS] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [partSearchTerm, setPartSearchTerm] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
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
    paymentMethod: 'pix' as 'cash' | 'pix' | 'card' | 'transfer',
    paymentType: 'cash' as 'cash' | 'deferred',
    dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd')
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

    return () => {
      unsubscribeOS();
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeServices();
      unsubscribeInventory();
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
            paymentMethod: os.paymentMethod || 'pix',
            paymentType: os.paymentType || 'cash',
            dueDate: os.dueDate || format(addDays(new Date(), 30), 'yyyy-MM-dd')
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
      
      if (editingOS) {
        if (editingOS.status === 'finalizada' || editingOS.status === 'entregue') {
          toast.error('Ordens de serviço finalizadas não podem ser editadas.');
          return;
        }

        // Update OS
        await updateDoc(doc(db, 'ordens_servico', editingOS.id), {
          clienteId: formData.clienteId,
          veiculoId: formData.veiculoId,
          status: formData.status,
          desconto: formData.desconto,
          valorTotal,
          observations: formData.observations,
          paymentMethod: formData.paymentMethod,
          paymentType: formData.paymentType,
          dueDate: formData.dueDate,
          updatedAt: serverTimestamp()
        });

        // If status changed to finalizada, use OSService.updateStatus to handle stock/finance
        if (formData.status === 'finalizada') {
          await OSService.updateStatus(editingOS.id, profile!.empresaId, 'finalizada', auth.currentUser?.uid || '', formData.observations);
        }
        
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
          observations: formData.observations,
          paymentMethod: formData.paymentMethod,
          paymentType: formData.paymentType,
          dueDate: formData.dueDate
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
        paymentMethod: os.paymentMethod || 'pix',
        paymentType: os.paymentType || 'cash',
        dueDate: os.dueDate || format(addDays(new Date(), 30), 'yyyy-MM-dd')
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
        paymentMethod: 'pix',
        paymentType: 'cash',
        dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd')
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
        paymentMethod: os.paymentMethod || 'pix',
        paymentType: os.paymentType || 'cash',
        dueDate: os.dueDate || format(addDays(new Date(), 30), 'yyyy-MM-dd')
      });
      setIsModalOpen(true);
      return;
    }

    try {
      if (os.status === 'finalizada' || os.status === 'entregue') {
        toast.error('Ordens de serviço finalizadas não podem ser alteradas.');
        return;
      }

      const osRef = doc(db, 'ordens_servico', os.id);
      await updateDoc(osRef, { 
        status: newStatus,
        updatedAt: serverTimestamp()
      });

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
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", statusMap[status].color.split(' ')[0].replace('bg-', 'bg-').replace('-50', '-500'))} />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{statusMap[status].label}</span>
              </div>
              <span className="text-[10px] font-black text-zinc-400 bg-white px-2 py-0.5 rounded-lg border border-zinc-100">
                {filteredOS.filter(os => os.status === status).length}
              </span>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              {filteredOS.filter(os => os.status === status).map(os => (
                <motion.div
                  layout
                  key={os.id}
                  onClick={() => openModal(os)}
                  className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-xl hover:border-accent/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold text-zinc-400">#{os.id.slice(0, 6).toUpperCase()}</span>
                    <span className="text-xs font-black text-zinc-900 font-display">{formatCurrency(os.valorTotal)}</span>
                  </div>
                  <h4 className="text-sm font-black text-zinc-900 mb-2 group-hover:text-accent transition-colors">{getClientName(os.clienteId)}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold">
                    <CarIcon size={12} className="text-zinc-300" />
                    {getVehicleInfo(os.veiculoId)}
                  </div>
                  <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-zinc-400">
                        {getClientName(os.clienteId).slice(0, 1)}
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold">{format(new Date(os.createdAt), 'dd/MM')}</span>
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
    <div className="space-y-10 animate-in">
      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-900 tracking-tighter font-display">Ordens de Serviço</h1>
          <p className="text-sm sm:text-lg text-zinc-500 font-medium mt-2">Gerencie e acompanhe todos os serviços da sua oficina.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200">
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === 'list' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              Lista
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === 'kanban' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              Kanban
            </button>
          </div>
          <div className="relative flex-1 w-full sm:min-w-[300px]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="input-modern !pl-14 !py-4"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canCreate && (
            <button 
              onClick={() => openModal()}
              className="btn-modern flex items-center justify-center gap-3 w-full sm:w-auto !px-8 !py-4"
            >
              <Plus size={22} />
              Nova Ordem
            </button>
          )}
        </div>
      </div>

      {/* OS List / Kanban */}
      <div className="grid grid-cols-1 gap-6 sm:gap-8">
        {loading ? (
          <div className="py-32 text-center">
            <Loader2 size={40} className="animate-spin text-accent mx-auto mb-4" />
            <p className="text-zinc-400 font-medium italic">Carregando ordens de serviço...</p>
          </div>
        ) : filteredOS.length > 0 ? (
          viewMode === 'list' ? (
            <div className="space-y-6">
              {filteredOS.map((os) => {
              const status = statusMap[os.status];
              return (
                <motion.div 
                  layout
                  key={os.id} 
                  className="modern-card !p-0 overflow-hidden group hover:border-accent/20 transition-all duration-500"
                >
                  <div className="flex flex-col lg:flex-row">
                    {/* Status Accent Bar */}
                    <div className={cn("w-full lg:w-2 h-2 lg:h-auto shrink-0", status.color.split(' ')[0].replace('bg-', 'bg-').replace('-50', '-500'))} />
                    
                    <div className="flex-1 p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center gap-10">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-4">
                          <span className="font-mono text-[10px] font-black text-zinc-400 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-100">
                            #{os.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className={cn(
                            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border",
                            status.color
                          )}>
                            <status.icon size={14} />
                            {status.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-zinc-50 text-zinc-400 rounded-[1.5rem] flex items-center justify-center font-black text-xl border border-zinc-100 group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent transition-all duration-500 shadow-sm">
                            {(getClientName(os.clienteId) || 'C').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-black text-zinc-900 truncate font-display group-hover:text-accent transition-colors duration-500">
                              {getClientName(os.clienteId)}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                              <span className="flex items-center gap-2 text-sm font-bold text-zinc-500">
                                <CarIcon size={16} className="text-zinc-300" /> 
                                {getVehicleInfo(os.veiculoId)}
                              </span>
                              <span className="flex items-center gap-2 text-sm font-bold text-zinc-500">
                                <Calendar size={16} className="text-zinc-300" /> 
                                {format(new Date(os.createdAt), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:max-w-[300px] lg:justify-center">
                        {os.servicos?.slice(0, 3).map((s, i) => (
                          <span key={i} className="px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-[10px] font-black text-zinc-500 uppercase tracking-widest group-hover:bg-white transition-colors">
                            {s.name}
                          </span>
                        ))}
                        {os.servicos?.length > 3 && (
                          <span className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                            +{os.servicos.length - 3}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-8 lg:min-w-[350px] lg:justify-end pt-8 lg:pt-0 border-t lg:border-t-0 border-zinc-100">
                        <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-[1.5rem] border border-zinc-100 shadow-inner">
                          {[
                            { id: 'em_execucao', icon: Wrench, color: 'text-blue-600', bg: 'hover:bg-blue-50', active: 'bg-blue-600 text-white shadow-lg shadow-blue-200', label: 'Em Andamento' },
                            { id: 'finalizada', icon: CheckCircle2, color: 'text-green-600', bg: 'hover:bg-green-50', active: 'bg-green-600 text-white shadow-lg shadow-green-200', label: 'Finalizar' },
                            { id: 'cancelada', icon: XCircle, color: 'text-red-600', bg: 'hover:bg-red-50', active: 'bg-red-600 text-white shadow-lg shadow-red-200', label: 'Cancelar' }
                          ].map((action) => (
                            <button 
                              key={action.id}
                              onClick={() => handleUpdateStatus(os, action.id as OSStatus)}
                              className={cn(
                                "p-3 rounded-xl transition-all duration-300 group/btn relative",
                                os.status === action.id ? action.active : cn("text-zinc-400", action.bg)
                              )}
                              title={action.label}
                            >
                              <action.icon size={20} />
                            </button>
                          ))}
                        </div>

                        <div className="text-center sm:text-right min-w-[120px]">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-2">Valor Total</p>
                          <p className="text-3xl font-black text-zinc-900 font-display tracking-tighter">{formatCurrency(os.valorTotal)}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button 
                              onClick={() => openModal(os)}
                              className="p-4 text-zinc-400 hover:text-accent hover:bg-accent/5 rounded-2xl transition-all active:scale-90"
                            >
                              <Edit2 size={22} />
                            </button>
                          )}
                          <div className="relative group/more">
                            <button className="p-4 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-all active:scale-90">
                              <MoreVertical size={22} />
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-zinc-100 rounded-[1.5rem] shadow-2xl opacity-0 invisible group-hover/more:opacity-100 group-hover/more:visible transition-all duration-300 z-20 overflow-hidden">
                              <button className="w-full flex items-center gap-3 px-6 py-4 text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
                                <Printer size={18} /> Imprimir OS
                              </button>
                              {os.status === 'finalizada' && (
                                <button 
                                  onClick={() => sendNotification(os)}
                                  className="w-full flex items-center gap-3 px-6 py-4 text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                                >
                                  <MessageSquare size={18} /> Notificar Cliente
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={() => handleDelete(os.id)}
                                  className="w-full flex items-center gap-3 px-6 py-4 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={18} /> Excluir OS
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <KanbanBoard />
        )
      ) : (
        <div className="py-32 text-center bg-zinc-50/50 rounded-[3rem] border border-dashed border-zinc-200">
          <ClipboardList size={64} className="text-zinc-200 mx-auto mb-6" />
          <h4 className="text-2xl font-black text-zinc-900 mb-2 font-display">Nenhuma OS encontrada</h4>
          <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Tente ajustar sua busca ou crie uma nova OS.</p>
        </div>
      )}
    </div>

      {/* OS Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-zinc-900/80 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-zinc-100"
            >
              {/* Decorative Background Element */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
              
              <div className="relative flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-8 sm:p-12 border-b border-zinc-100 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10">
                  <div>
                    <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tighter font-display">
                      {editingOS ? 'Editar Ordem' : 'Nova Ordem de Serviço'}
                    </h2>
                    <p className="text-zinc-500 font-medium mt-2">Preencha os detalhes para {editingOS ? 'atualizar' : 'emitir'} a OS.</p>
                  </div>
                  <button 
                    onClick={closeModal}
                    className="p-4 hover:bg-zinc-100 rounded-2xl transition-all active:scale-90"
                  >
                    <XCircle size={28} className="text-zinc-400" />
                  </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Left Column: Client & Vehicle */}
                    <div className="space-y-10">
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 text-accent">
                          <User size={20} />
                          <h3 className="text-sm font-black uppercase tracking-[0.2em]">Cliente & Veículo</h3>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cliente</label>
                            <select 
                              className="input-modern"
                              value={formData.clienteId}
                              onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                              required
                            >
                              <option value="">Selecione um cliente</option>
                              {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Veículo</label>
                            <select 
                              className="input-modern"
                              value={formData.veiculoId}
                              onChange={(e) => setFormData({ ...formData, veiculoId: e.target.value })}
                              required
                            >
                              <option value="">Selecione um veículo</option>
                              {vehicles
                                .filter(v => v.clienteId === formData.clienteId)
                                .map(v => (
                                  <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                                ))
                              }
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center gap-3 text-accent">
                          <Clock size={20} />
                          <h3 className="text-sm font-black uppercase tracking-[0.2em]">Status & Pagamento</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Status</label>
                            <select 
                              className="input-modern"
                              value={formData.status}
                              onChange={(e) => setFormData({ ...formData, status: e.target.value as OSStatus })}
                            >
                              {Object.entries(statusMap).map(([key, value]) => (
                                <option key={key} value={key}>{value.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Tipo de Pagamento</label>
                            <select 
                              className="input-modern"
                              value={formData.paymentType}
                              onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as any })}
                            >
                              <option value="cash">À Vista</option>
                              <option value="deferred">A Prazo (Faturado)</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                            <select 
                              className="input-modern"
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
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Data de Vencimento</label>
                              <input 
                                type="date"
                                className="input-modern"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Services */}
                    <div className="space-y-10">
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 text-accent">
                          <Wrench size={20} />
                          <h3 className="text-sm font-black uppercase tracking-[0.2em]">Serviços & Peças</h3>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                            <input 
                              type="text" 
                              placeholder="Buscar serviços..." 
                              className="input-modern !pl-12"
                              value={serviceSearchTerm}
                              onChange={(e) => setServiceSearchTerm(e.target.value)}
                            />
                            {serviceSearchTerm && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-100 rounded-2xl shadow-2xl z-20 max-h-60 overflow-y-auto p-2">
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
                                      className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 rounded-xl transition-colors text-left group"
                                    >
                                      <div>
                                        <p className="font-bold text-zinc-900 group-hover:text-accent transition-colors">{s.name}</p>
                                        <p className="text-xs text-zinc-400 font-medium">{formatCurrency(s.price)}</p>
                                      </div>
                                      <Plus size={18} className="text-zinc-300 group-hover:text-accent" />
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                            <input 
                              type="text" 
                              placeholder="Buscar peças..." 
                              className="input-modern !pl-12"
                              value={partSearchTerm}
                              onChange={(e) => setPartSearchTerm(e.target.value)}
                            />
                            {partSearchTerm && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-100 rounded-2xl shadow-2xl z-20 max-h-60 overflow-y-auto p-2">
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
                                      className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 rounded-xl transition-colors text-left group"
                                    >
                                      <div>
                                        <p className="font-bold text-zinc-900 group-hover:text-accent transition-colors">{p.name}</p>
                                        <p className="text-xs text-zinc-400 font-medium">{formatCurrency(p.precoVenda)} - Estoque: {p.quantidadeAtual}</p>
                                      </div>
                                      <Plus size={18} className="text-zinc-300 group-hover:text-accent" />
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            {formData.selectedServices.map((s, i) => (
                              <div key={`service-${i}`} className="flex items-center justify-between p-5 bg-zinc-50 border border-zinc-100 rounded-2xl group hover:bg-white hover:border-accent/20 transition-all">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Serviço</span>
                                    <p className="font-bold text-zinc-900">{s.name}</p>
                                  </div>
                                  <div className="flex items-center gap-4 mt-1">
                                    <span className="text-xs font-black text-accent">{formatCurrency(s.price)}</span>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const newServices = [...formData.selectedServices];
                                          newServices[i].quantity = Math.max(1, newServices[i].quantity - 1);
                                          setFormData({ ...formData, selectedServices: newServices });
                                        }}
                                        className="p-1 hover:bg-zinc-100 rounded-lg"
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="text-xs font-bold text-zinc-600">{s.quantity}</span>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const newServices = [...formData.selectedServices];
                                          newServices[i].quantity += 1;
                                          setFormData({ ...formData, selectedServices: newServices });
                                        }}
                                        className="p-1 hover:bg-zinc-100 rounded-lg"
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => removeServiceFromOS(i)}
                                  className="p-3 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}

                            {formData.selectedParts.map((p, i) => (
                              <div key={`part-${i}`} className="flex items-center justify-between p-5 bg-zinc-50 border border-zinc-100 rounded-2xl group hover:bg-white hover:border-accent/20 transition-all">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Peça</span>
                                    <p className="font-bold text-zinc-900">{p.name}</p>
                                  </div>
                                  <div className="flex items-center gap-4 mt-1">
                                    <span className="text-xs font-black text-accent">{formatCurrency(p.price)}</span>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const newParts = [...formData.selectedParts];
                                          newParts[i].quantity = Math.max(1, newParts[i].quantity - 1);
                                          setFormData({ ...formData, selectedParts: newParts });
                                        }}
                                        className="p-1 hover:bg-zinc-100 rounded-lg"
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="text-xs font-bold text-zinc-600">{p.quantity}</span>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const newParts = [...formData.selectedParts];
                                          newParts[i].quantity += 1;
                                          setFormData({ ...formData, selectedParts: newParts });
                                        }}
                                        className="p-1 hover:bg-zinc-100 rounded-lg"
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => removePartFromOS(i)}
                                  className="p-3 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}

                            {formData.selectedServices.length === 0 && formData.selectedParts.length === 0 && (
                              <div className="py-12 text-center border-2 border-dashed border-zinc-100 rounded-[2rem]">
                                <p className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Nenhum item selecionado</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-accent">
                            <MessageSquare size={20} />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em]">Observações</h3>
                          </div>
                          <button
                            type="button"
                            onClick={handleGenerateAIObservations}
                            disabled={isGeneratingAI}
                            className="flex items-center gap-2 text-[10px] font-black text-accent uppercase tracking-widest hover:bg-accent/5 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                          >
                            {isGeneratingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Gerar com IA
                          </button>
                        </div>
                        <textarea 
                          className="input-modern min-h-[120px] resize-none"
                          placeholder="Detalhes técnicos, recomendações ou observações gerais..."
                          value={formData.observations}
                          onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div className="mt-12 p-8 sm:p-10 bg-zinc-900 rounded-[2.5rem] text-white flex flex-col sm:flex-row items-center justify-between gap-8 shadow-2xl shadow-zinc-200">
                    <div className="flex flex-wrap items-center gap-10">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Subtotal</p>
                        <p className="text-xl font-bold text-zinc-300">{formatCurrency(calculateTotal() + formData.desconto)}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Desconto</p>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                          <input 
                            type="number"
                            className="bg-zinc-800 border-none rounded-xl pl-10 pr-4 py-2 w-32 text-sm font-bold focus:ring-2 focus:ring-accent transition-all"
                            value={formData.desconto}
                            onChange={(e) => setFormData({ ...formData, desconto: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-[10px] font-black text-accent uppercase tracking-[0.4em] mb-2">Total Final</p>
                      <p className="text-5xl font-black font-display tracking-tighter">{formatCurrency(calculateTotal())}</p>
                    </div>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-8">
                    <button 
                      type="button"
                      onClick={closeModal}
                      className="w-full sm:w-auto px-10 py-4 text-sm font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors"
                    >
                      Descartar
                    </button>
                    <button 
                      type="submit"
                      className="btn-modern w-full sm:w-auto !px-12 !py-4 flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 size={20} />
                      {editingOS ? 'Salvar Alterações' : 'Emitir Ordem de Serviço'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Ordem de Serviço?"
        message="Tem certeza que deseja excluir esta OS? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default ServiceOrders;

