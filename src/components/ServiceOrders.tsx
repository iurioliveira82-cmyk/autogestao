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
  MessageSquare
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, getDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder, Client, Vehicle, Service, OSStatus, ServiceOrderItem } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ServiceOrdersProps {
  setActiveTab: (tab: string) => void;
}

const ServiceOrders: React.FC<ServiceOrdersProps> = ({ setActiveTab }) => {
  const [osList, setOsList] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOS, setEditingOS] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const { canCreate, canEdit, canDelete } = usePermissions('os');

  // Form state
  const [formData, setFormData] = useState({
    clientId: '',
    vehicleId: '',
    status: 'waiting' as OSStatus,
    selectedServices: [] as ServiceOrderItem[],
    discount: 0,
    observations: '',
    paymentMethod: 'pix' as 'cash' | 'pix' | 'card'
  });

  useEffect(() => {
    const qOS = query(collection(db, 'serviceOrders'), orderBy('createdAt', 'desc'));
    const unsubscribeOS = onSnapshot(qOS, (snapshot) => {
      const list: ServiceOrder[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ServiceOrder);
      });
      setOsList(list);
      setLoading(false);
    });

    const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      const list: Client[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Client));
      setClients(list);
    });

    const unsubscribeVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      const list: Vehicle[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(list);
    });

    const unsubscribeServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const list: Service[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Service));
      setServices(list);
    });

    return () => {
      unsubscribeOS();
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeServices();
    };
  }, []);

  const calculateTotal = () => {
    const subtotal = formData.selectedServices.reduce((acc, s) => acc + s.price, 0);
    return Math.max(0, subtotal - formData.discount);
  };

  const calculateTotalCost = () => {
    return formData.selectedServices.reduce((acc, s) => acc + (s.cost || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId || !formData.vehicleId || formData.selectedServices.length === 0) {
      toast.error('Cliente, veículo e pelo menos um serviço são obrigatórios.');
      return;
    }

    try {
      const totalValue = calculateTotal();
      const totalCost = calculateTotalCost();
      const data = {
        clientId: formData.clientId,
        vehicleId: formData.vehicleId,
        status: formData.status,
        services: formData.selectedServices,
        discount: formData.discount,
        totalValue,
        totalCost,
        observations: formData.observations,
        paymentMethod: formData.paymentMethod,
        updatedAt: serverTimestamp()
      };

      if (editingOS) {
        // Business rule: Finished OS cannot be edited
        if (editingOS.status === 'finished') {
          toast.error('Ordens de serviço finalizadas não podem ser editadas.');
          return;
        }

        await updateDoc(doc(db, 'serviceOrders', editingOS.id), data);
        
        // If finished or confirmed, create a financial transaction and send notification
        if ((formData.status === 'finished' || formData.status === 'confirmed') && editingOS.status !== formData.status) {
          // Revenue transaction
          await addDoc(collection(db, 'transactions'), {
            type: 'in',
            value: totalValue,
            category: 'Serviço',
            description: `OS #${editingOS.id.slice(0, 6)} - ${getClientName(formData.clientId)}`,
            date: new Date().toISOString(),
            status: formData.status === 'finished' ? 'paid' : 'pending',
            paymentMethod: formData.paymentMethod,
            relatedOSId: editingOS.id
          });

          // Cost transaction
          if (totalCost > 0) {
            await addDoc(collection(db, 'transactions'), {
              type: 'out',
              value: totalCost,
              category: 'Custo de Serviço',
              description: `Custo OS #${editingOS.id.slice(0, 6)} - ${getClientName(formData.clientId)}`,
              date: new Date().toISOString(),
              status: 'paid',
              relatedOSId: editingOS.id
            });
          }

          // Deduct inventory if finished
          if (formData.status === 'finished') {
            await deductInventory(formData.selectedServices);
          }

          // Trigger notification
          const updatedOS = { ...editingOS, ...data, totalValue, totalCost };
          sendNotification(updatedOS as any);
          
          setActiveTab('finance');
        } else if (formData.status === 'cancelled' && editingOS.status !== 'cancelled') {
          setActiveTab('finance');
        }
        
        toast.success('OS atualizada com sucesso!');
      } else {
        const newDoc = await addDoc(collection(db, 'serviceOrders'), {
          ...data,
          createdAt: new Date().toISOString()
        });

        // If finished or confirmed immediately, create transaction and send notification
        if (formData.status === 'finished' || formData.status === 'confirmed') {
          // Revenue transaction
          await addDoc(collection(db, 'transactions'), {
            type: 'in',
            value: totalValue,
            category: 'Serviço',
            description: `OS #${newDoc.id.slice(0, 6)} - ${getClientName(formData.clientId)}`,
            date: new Date().toISOString(),
            status: formData.status === 'finished' ? 'paid' : 'pending',
            paymentMethod: formData.paymentMethod,
            relatedOSId: newDoc.id
          });

          // Cost transaction
          if (totalCost > 0) {
            await addDoc(collection(db, 'transactions'), {
              type: 'out',
              value: totalCost,
              category: 'Custo de Serviço',
              description: `Custo OS #${newDoc.id.slice(0, 6)} - ${getClientName(formData.clientId)}`,
              date: new Date().toISOString(),
              status: 'paid',
              relatedOSId: newDoc.id
            });
          }

          // Deduct inventory if finished
          if (formData.status === 'finished') {
            await deductInventory(formData.selectedServices);
          }

          // Trigger notification
          const newOS = { id: newDoc.id, ...data, totalValue, totalCost };
          sendNotification(newOS as any);
          
          setActiveTab('finance');
        } else if (formData.status === 'cancelled') {
          setActiveTab('finance');
        }

        toast.success('OS criada com sucesso!');
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar OS.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta OS?')) {
      try {
        await deleteDoc(doc(db, 'serviceOrders', id));
        toast.success('OS excluída com sucesso!');
      } catch (error) {
        console.error(error);
        toast.error('Erro ao excluir OS.');
      }
    }
  };

  const openModal = (os?: ServiceOrder) => {
    if (os) {
      setEditingOS(os);
      setFormData({
        clientId: os.clientId,
        vehicleId: os.vehicleId,
        status: os.status,
        selectedServices: os.services,
        discount: os.discount || 0,
        observations: os.observations || '',
        paymentMethod: os.paymentMethod || 'pix'
      });
    } else {
      setEditingOS(null);
      setFormData({
        clientId: '',
        vehicleId: '',
        status: 'waiting',
        selectedServices: [],
        discount: 0,
        observations: '',
        paymentMethod: 'pix'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOS(null);
    setServiceSearchTerm('');
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Desconhecido';
  const getVehicleInfo = (id: string) => {
    const v = vehicles.find(v => v.id === id);
    return v ? `${v.brand} ${v.model} (${v.plate})` : 'Desconhecido';
  };

  const sendNotification = async (os: Partial<ServiceOrder> & { id: string }) => {
    const client = clients.find(c => c.id === os.clientId);
    const vehicle = vehicles.find(v => v.id === os.vehicleId);
    
    if (!client || !client.phone) {
      toast.error('Cliente não possui telefone cadastrado.');
      return;
    }

    const message = `Olá ${client.name}! O serviço no seu veículo ${vehicle?.brand} ${vehicle?.model} (${vehicle?.plate}) foi concluído. O valor total é ${formatCurrency(os.totalValue || 0)}. Já pode vir buscar!`;
    
    // In a real app, you'd call an API here (SMS, Email, WhatsApp API)
    // For this demo, we'll open a WhatsApp link and show a toast
    const whatsappUrl = `https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    
    try {
      window.open(whatsappUrl, '_blank');
      await updateDoc(doc(db, 'serviceOrders', os.id), {
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
        if (service.products) {
          for (const product of service.products) {
            const productRef = doc(db, 'inventory', product.inventoryItemId);
            await updateDoc(productRef, {
              quantity: increment(-product.quantity)
            });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao dar baixa no estoque:', error);
      toast.error('Erro ao dar baixa no estoque.');
    }
  };

  const addServiceToOS = (service: Service) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: [...prev.selectedServices, { 
        serviceId: service.id, 
        name: service.name, 
        price: service.price,
        cost: service.cost || 0,
        products: service.products || []
      }]
    }));
  };

  const removeServiceFromOS = (index: number) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.filter((_, i) => i !== index)
    }));
  };

  const filteredOS = osList.filter(os => 
    getClientName(os.clientId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getVehicleInfo(os.vehicleId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    os.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusMap = {
    waiting: { label: 'Aguardando', color: 'bg-zinc-100 text-zinc-600', icon: Clock },
    confirmed: { label: 'Confirmada', color: 'bg-purple-50 text-purple-600', icon: CheckCircle2 },
    'in-progress': { label: 'Em Andamento', color: 'bg-blue-50 text-blue-600', icon: Wrench },
    finished: { label: 'Finalizado', color: 'bg-green-50 text-green-600', icon: CheckCircle2 },
    cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-600', icon: XCircle },
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por cliente, veículo ou ID..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canCreate && (
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
          >
            <Plus size={20} />
            Nova OS
          </button>
        )}
      </div>

      {/* OS List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center text-zinc-400 italic">Carregando ordens de serviço...</div>
        ) : filteredOS.length > 0 ? filteredOS.map((os) => {
          const status = statusMap[os.status];
          return (
            <div key={os.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-zinc-400">#{os.id.slice(0, 6)}</span>
                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", status.color)}>
                    <status.icon size={12} />
                    {status.label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-1">{getClientName(os.clientId)}</h3>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <span className="flex items-center gap-1.5"><CarIcon size={14} /> {getVehicleInfo(os.vehicleId)}</span>
                  <span className="flex items-center gap-1.5"><Calendar size={14} /> {format(new Date(os.createdAt), 'dd/MM/yyyy')}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:flex-1">
                {os.services?.map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-lg text-xs font-medium text-zinc-600">
                    {s.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-8 border-t lg:border-t-0 pt-4 lg:pt-0 border-zinc-100">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-xl font-black text-zinc-900">{formatCurrency(os.totalValue)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button 
                      onClick={() => openModal(os)}
                      className="p-3 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                    >
                      <Edit2 size={20} />
                    </button>
                  )}
                  {os.status === 'finished' && (
                    <button 
                      onClick={() => sendNotification(os)}
                      className={cn(
                        "p-3 rounded-xl transition-all",
                        os.notificationSent 
                          ? "text-green-500 hover:text-green-600 hover:bg-green-50" 
                          : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                      )}
                      title={os.notificationSent ? "Notificação já enviada" : "Enviar notificação"}
                    >
                      <MessageSquare size={20} />
                    </button>
                  )}
                  <button className="p-3 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all">
                    <Printer size={20} />
                  </button>
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(os.id)}
                      className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="py-20 text-center text-zinc-400 italic">Nenhuma ordem de serviço encontrada.</div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">
                  {editingOS ? `Editar OS #${editingOS.id.slice(0, 6)}` : 'Nova Ordem de Serviço'}
                </h3>
                <p className="text-sm text-zinc-500">Preencha os detalhes do serviço abaixo</p>
              </div>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Client & Vehicle Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                    <User size={16} /> Cliente
                  </label>
                  <select 
                    required
                    disabled={!!editingOS}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value, vehicleId: '' })}
                  >
                    <option value="">Selecione um cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                    <CarIcon size={16} /> Veículo
                  </label>
                  <select 
                    required
                    disabled={!formData.clientId || !!editingOS}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.vehicleId}
                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  >
                    <option value="">Selecione um veículo...</option>
                    {vehicles.filter(v => v.clientId === formData.clientId).map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Services Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                    <Wrench size={16} /> Serviços Realizados
                  </label>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar serviço..." 
                      className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                      value={serviceSearchTerm}
                      onChange={(e) => setServiceSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4 max-h-32 overflow-y-auto p-1">
                  {services
                    .filter(s => s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()))
                    .map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addServiceToOS(s)}
                        className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all"
                      >
                        + {s.name} ({formatCurrency(s.price)})
                      </button>
                    ))}
                </div>

                <div className="bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200">
                        <th className="px-6 py-3">Serviço</th>
                        <th className="px-6 py-3">Preço</th>
                        <th className="px-6 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {formData.selectedServices?.map((s, i) => (
                        <tr key={i} className="text-sm">
                          <td className="px-6 py-4">
                            <div className="font-bold text-zinc-900">{s.name}</div>
                            {s.products && s.products.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {s.products?.map((p, idx) => (
                                  <span key={idx} className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200 flex items-center gap-1">
                                    <Package size={8} /> {p.name} ({p.quantity})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-zinc-600">{formatCurrency(s.price)}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              type="button"
                              onClick={() => removeServiceFromOS(i)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <XCircle size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formData.selectedServices.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-zinc-400 italic">Nenhum serviço selecionado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status & Financials */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Status da OS</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as OSStatus })}
                  >
                    <option value="waiting">Aguardando</option>
                    <option value="confirmed">Confirmada</option>
                    <option value="in-progress">Em Andamento</option>
                    <option value="finished">Finalizado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Forma de Pagamento</label>
                  <select 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                  >
                    <option value="pix">Pix</option>
                    <option value="card">Cartão</option>
                    <option value="cash">Dinheiro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Desconto (R$)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    placeholder="0.00"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Observações</label>
                <textarea 
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all min-h-[100px]"
                  placeholder="Detalhes adicionais, diagnóstico, peças usadas..."
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                />
              </div>

              <div className="p-8 bg-zinc-900 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex flex-wrap gap-8">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Total OS</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black">{formatCurrency(calculateTotal())}</span>
                      {formData.discount > 0 && (
                        <span className="text-sm text-zinc-400 line-through">
                          {formatCurrency(formData.selectedServices.reduce((acc, s) => acc + s.price, 0))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:block w-px h-12 bg-white/10" />
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Lucro Estimado</p>
                    <p className={cn(
                      "text-xl font-bold",
                      (calculateTotal() - formData.selectedServices.reduce((acc, s) => acc + s.cost, 0)) > 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {formatCurrency(calculateTotal() - formData.selectedServices.reduce((acc, s) => acc + s.cost, 0))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="flex-1 sm:flex-none px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 sm:flex-none px-8 py-4 bg-white text-zinc-900 font-bold rounded-2xl hover:bg-zinc-100 transition-all shadow-xl"
                  >
                    {editingOS ? 'Salvar OS' : 'Criar Ordem de Serviço'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrders;
