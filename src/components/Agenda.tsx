import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search,
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Car, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Appointment, Client, Vehicle, Service, OperationType } from '../types';
import { auth } from '../firebase';
import { useAuth } from './Auth';
import { usePermissions } from '../hooks/usePermissions';
import { cn, handleFirestoreError } from '../lib/utils';
import { format, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ConfirmationModal } from './ConfirmationModal';

interface AgendaProps {
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: any) => void;
}

const Agenda: React.FC<AgendaProps> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions('agenda');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    clienteId: '',
    veiculoId: '',
    servicoIds: [] as string[],
    startTime: '',
    endTime: '',
    status: 'scheduled' as 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  });
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');

  useEffect(() => {
    if (!profile?.empresaId) return;

    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);

    const q = query(
      collection(db, 'agendamentos'),
      where('empresaId', '==', profile.empresaId),
      where('startTime', '>=', start.toISOString()),
      where('startTime', '<=', end.toISOString()),
      orderBy('startTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Appointment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Appointment);
      });
      setAppointments(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'agendamentos');
      setLoading(false);
    });

    const unsubscribeClients = onSnapshot(
      query(collection(db, 'clientes'), where('empresaId', '==', profile.empresaId)), 
      (snapshot) => {
        const list: Client[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Client));
        setClients(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'clientes');
      }
    );

    const unsubscribeVehicles = onSnapshot(
      query(collection(db, 'veiculos'), where('empresaId', '==', profile.empresaId)), 
      (snapshot) => {
        const list: Vehicle[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Vehicle));
        setVehicles(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'veiculos');
      }
    );

    const unsubscribeServices = onSnapshot(
      query(collection(db, 'catalogo_servicos'), where('empresaId', '==', profile.empresaId)), 
      (snapshot) => {
        const list: Service[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Service));
        setServices(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'catalogo_servicos');
      }
    );

    return () => {
      unsubscribe();
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeServices();
    };
  }, [selectedDate, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clienteId || !formData.veiculoId || !formData.startTime || !formData.endTime || formData.servicoIds.length === 0) {
      toast.error('Todos os campos são obrigatórios, incluindo ao menos um serviço.');
      return;
    }

    try {
      // Check for conflicts
      const conflict = appointments.find(app => {
        const appStart = new Date(app.startTime);
        const appEnd = new Date(app.endTime);
        const newStart = new Date(formData.startTime);
        const newEnd = new Date(formData.endTime);
        
        return (newStart < appEnd && newEnd > appStart);
      });

      if (conflict) {
        toast.error('Já existe um agendamento neste horário.');
        return;
      }

      await addDoc(collection(db, 'agendamentos'), {
        ...formData,
        empresaId: profile?.empresaId,
        createdAt: serverTimestamp()
      });
      
      toast.success('Agendamento realizado com sucesso!');
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao agendar.');
    }
  };

  const handleDelete = async (id: string) => {
    setAppointmentToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!appointmentToDelete) return;
    try {
      await deleteDoc(doc(db, 'agendamentos', appointmentToDelete));
      toast.success('Agendamento excluído com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir agendamento.');
    } finally {
      setAppointmentToDelete(null);
    }
  };

  const updateStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'agendamentos', id), { status });
      
      if (status === 'confirmed') {
        const app = appointments.find(a => a.id === id);
        if (app) {
          const selectedServices = services.filter(s => app.servicoIds?.includes(s.id));
          if (selectedServices.length > 0) {
            const totalValue = selectedServices.reduce((acc, s) => acc + s.price, 0);
            const totalCost = selectedServices.reduce((acc, s) => acc + (s.precoCusto || 0), 0);
            
            await addDoc(collection(db, 'ordens_servico'), {
              empresaId: profile?.empresaId,
              clienteId: app.clienteId,
              veiculoId: app.veiculoId,
              status: 'aguardando',
              services: selectedServices.map(s => ({
                serviceId: s.id,
                name: s.name,
                price: s.price,
                cost: s.precoCusto || 0,
                products: s.produtos || []
              })),
              valorTotal: totalValue,
              totalValue: totalValue, // Alias
              desconto: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            toast.success('OS gerada com sucesso!');
            setActiveTab('os');
          }
        }
      } else {
        toast.success('Status atualizado!');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar status.');
    }
  };

  const openModal = () => {
    setFormData({
      clienteId: '',
      veiculoId: '',
      servicoIds: [],
      startTime: format(selectedDate, "yyyy-MM-dd'T'HH:mm"),
      endTime: format(selectedDate, "yyyy-MM-dd'T'HH:mm"),
      status: 'scheduled'
    });
    setServiceSearchTerm('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setServiceSearchTerm('');
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Desconhecido';
  const getVehicleInfo = (id: string) => {
    const v = vehicles.find(v => v.id === id);
    return v ? `${v.brand} ${v.model} (${v.plate})` : 'Desconhecido';
  };
  const getServiceNames = (ids: string[]) => {
    if (!ids || ids.length === 0) return 'Nenhum serviço';
    return ids.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(', ');
  };

  const statusMap = {
    scheduled: { label: 'Agendado', color: 'bg-blue-50 text-blue-600', icon: Clock },
    confirmed: { label: 'Confirmado', color: 'bg-green-50 text-green-600', icon: CheckCircle2 },
    cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-600', icon: XCircle },
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400 hover:text-zinc-900"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="text-center min-w-[180px]">
              <h3 className="text-xl font-bold text-zinc-900 capitalize">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Agenda Diária</p>
            </div>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400 hover:text-zinc-900"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          <button 
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-2 text-xs font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all"
          >
            Hoje
          </button>
        </div>
        
        {canCreate && (
          <button 
            onClick={openModal}
            className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-zinc-200"
          >
            <Plus size={20} />
            Agendar Horário
          </button>
        )}
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-zinc-400 italic">Carregando agenda...</div>
        ) : appointments.length > 0 ? appointments.map((app) => {
          const status = statusMap[app.status];
          return (
            <div key={app.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex flex-col items-center justify-center sm:border-r border-zinc-100 sm:pr-8 min-w-[100px]">
                <span className="text-2xl font-black text-zinc-900">{format(new Date(app.startTime), 'HH:mm')}</span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Início</span>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", status.color)}>
                    <status.icon size={12} />
                    {status.label}
                  </span>
                  <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                    <Clock size={12} />
                    Até {format(new Date(app.endTime), 'HH:mm')}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-zinc-900 mb-1">{getClientName(app.clienteId)}</h4>
                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                  <span className="flex items-center gap-1.5"><Car size={14} /> {getVehicleInfo(app.veiculoId || '')}</span>
                  <span className="flex items-center gap-1.5 font-bold text-zinc-900">
                    <AlertCircle size={14} className="text-zinc-400" /> 
                    {getServiceNames(app.servicoIds)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:border-l border-zinc-100 sm:pl-8">
                {app.status === 'scheduled' && canEdit && (
                  <>
                    <button 
                      onClick={() => updateStatus(app.id, 'confirmed')}
                      className="p-3 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-all"
                      title="Confirmar"
                    >
                      <CheckCircle2 size={20} />
                    </button>
                    <button 
                      onClick={() => updateStatus(app.id, 'cancelled')}
                      className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                      title="Cancelar"
                    >
                      <XCircle size={20} />
                    </button>
                  </>
                )}
                {app.status !== 'scheduled' && canDelete && (
                  <button 
                    onClick={() => handleDelete(app.id)}
                    className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="py-20 bg-white rounded-3xl border border-dashed border-zinc-200 text-center">
            <CalendarIcon size={48} className="mx-auto text-zinc-200 mb-4" />
            <p className="text-zinc-400 font-medium">Nenhum agendamento para este dia.</p>
            <button 
              onClick={openModal}
              className="mt-4 text-sm font-bold text-accent hover:underline"
            >
              Agendar agora
            </button>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900">Novo Agendamento</h3>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Cliente</label>
                <select 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  value={formData.clienteId}
                  onChange={(e) => setFormData({ ...formData, clienteId: e.target.value, veiculoId: '' })}
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Veículo</label>
                  <select 
                    required
                    disabled={!formData.clienteId}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    value={formData.veiculoId}
                    onChange={(e) => setFormData({ ...formData, veiculoId: e.target.value })}
                  >
                    <option value="">Selecione um veículo...</option>
                    {vehicles.filter(v => v.clienteId === formData.clienteId).map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest flex items-center justify-between">
                    <span>Serviços</span>
                    <span className="text-[10px] text-zinc-400">{formData.servicoIds.length} selecionados</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar serviço..." 
                      className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                      value={serviceSearchTerm}
                      onChange={(e) => setServiceSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
 
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 bg-zinc-50 rounded-xl border border-zinc-100">
                  {services
                    .filter(s => s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()))
                    .map(s => {
                      const isSelected = formData.servicoIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              servicoIds: isSelected 
                                ? prev.servicoIds.filter(id => id !== s.id)
                                : [...prev.servicoIds, s.id]
                            }));
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            isSelected 
                              ? "bg-accent text-accent-foreground border-accent" 
                              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                          )}
                        >
                          {isSelected ? '✓ ' : '+ '} {s.name}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Início</label>
                  <input 
                    type="datetime-local" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 uppercase tracking-widest">Fim</label>
                  <input 
                    type="datetime-local" 
                    required
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center gap-4">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-4 border border-zinc-200 text-zinc-600 font-bold rounded-2xl hover:bg-zinc-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-accent text-accent-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-zinc-200"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Agendamento?"
        message="Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Agenda;
