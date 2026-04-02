import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Car, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Appointment, Client, Vehicle, Service, OperationType } from '../../types';
import { useAuth } from '../auth/Auth';
import { usePermissions } from '../../hooks/usePermissions';
import { cn, handleFirestoreError } from '../../utils';
import { format, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SearchBar } from '../../components/ui/SearchBar';

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
    <div className="space-y-8">
      <PageHeader 
        title="Agenda" 
        description="Gerencie seus agendamentos e compromissos."
        action={canCreate && (
          <Button onClick={openModal} variant="primary" icon={<Plus size={18} />}>
            Agendar Horário
          </Button>
        )}
      />

      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="text-center min-w-[180px]">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Agenda Diária</p>
            </div>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          <button 
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-2 text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-400 italic">Carregando agenda...</div>
        ) : appointments.length > 0 ? appointments.map((app) => {
          const status = statusMap[app.status];
          return (
            <div key={app.id} className="modern-card p-6 flex flex-col sm:flex-row sm:items-center gap-6 group">
              <div className="flex flex-col items-center justify-center sm:border-r border-slate-100 dark:border-slate-800 sm:pr-8 min-w-[100px]">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{format(new Date(app.startTime), 'HH:mm')}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Início</span>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", status.color)}>
                    <status.icon size={12} />
                    {status.label}
                  </span>
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    Até {format(new Date(app.endTime), 'HH:mm')}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{getClientName(app.clienteId)}</h4>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><Car size={14} /> {getVehicleInfo(app.veiculoId || '')}</span>
                  <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-300">
                    <AlertCircle size={14} className="text-slate-400" /> 
                    {getServiceNames(app.servicoIds)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:border-l border-slate-100 dark:border-slate-800 sm:pl-8 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
            <CalendarIcon size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
            <p className="text-slate-400 font-medium">Nenhum agendamento para este dia.</p>
            <button 
              onClick={openModal}
              className="mt-4 text-sm font-bold text-accent hover:underline"
            >
              Agendar agora
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Novo Agendamento"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cliente</label>
            <select 
              required
              className="select-modern"
              value={formData.clienteId}
              onChange={(e) => setFormData({ ...formData, clienteId: e.target.value, veiculoId: '' })}
            >
              <option value="">Selecione um cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Veículo</label>
              <select 
                required
                disabled={!formData.clienteId}
                className="select-modern"
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                <span>Serviços</span>
                <span className="text-[10px] text-slate-400">{formData.servicoIds.length} selecionados</span>
              </label>
              <SearchBar 
                placeholder="Buscar serviço..." 
                className="py-2 text-xs"
                value={serviceSearchTerm}
                onChange={(e) => setServiceSearchTerm(e.target.value)}
                onClear={() => setServiceSearchTerm('')}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
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
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Início</label>
              <input 
                type="datetime-local" 
                required
                className="input-modern"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fim</label>
              <input 
                type="datetime-local" 
                required
                className="input-modern"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <Button 
              type="button"
              variant="outline"
              onClick={closeModal}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              variant="primary"
              className="flex-1"
            >
              Confirmar Agendamento
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
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
