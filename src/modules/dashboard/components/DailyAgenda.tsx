import React from 'react';
import { Calendar, ArrowUpRight, Car, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { Appointment, Vehicle } from '../../../types';
import { cn } from '../../../utils';
import { Card, Badge } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

interface DailyAgendaProps {
  appointments: Appointment[];
  clients: Record<string, string>;
  vehicles: Record<string, Vehicle>;
  services: Record<string, string>;
  setActiveTab?: (tab: string) => void;
}

export const DailyAgenda: React.FC<DailyAgendaProps> = ({ appointments, clients, vehicles, services, setActiveTab }) => {
  return (
    <Card className="lg:col-span-2 !p-10 sm:!p-16 group">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12">
        <div>
          <h3 className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white tracking-tight font-display">Agenda do Dia</h3>
          <p className="text-base sm:text-lg text-slate-500 font-medium mt-2">Compromissos agendados para hoje</p>
        </div>
        <Button 
          variant="secondary"
          onClick={() => setActiveTab?.('agenda')}
          icon={<ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
        >
          Ver Agenda Completa
        </Button>
      </div>

      <div className="space-y-8 max-h-[600px] overflow-y-auto pr-6 custom-scrollbar">
        {appointments.length > 0 ? (
          appointments.map((appointment) => (
            <div 
              key={appointment.id} 
              className="flex items-start gap-8 p-8 rounded-[2.5rem] border border-border hover:border-accent/30 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all duration-500 group/item"
            >
              <div className="flex flex-col items-center justify-center min-w-[80px] py-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white rounded-3xl shadow-sm group-hover/item:bg-accent group-hover/item:text-accent-foreground transition-all duration-500">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                  {format(new Date(appointment.startTime), 'HH:mm')}
                </span>
                <div className="w-6 h-px bg-current opacity-20 my-2" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                  {format(new Date(appointment.endTime), 'HH:mm')}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-black text-slate-800 dark:text-white truncate group-hover/item:text-accent transition-colors font-display">
                    {clients[appointment.clienteId] || 'Cliente não encontrado'}
                  </h4>
                  <Badge variant={appointment.status === 'confirmed' ? 'success' : appointment.status === 'cancelled' ? 'danger' : 'info'}>
                    {appointment.status === 'confirmed' ? 'Confirmado' : 
                     appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-bold">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover/item:bg-white dark:group-hover/item:bg-slate-900 transition-colors">
                      <Car size={18} className="text-slate-400" />
                    </div>
                    <span>
                      {vehicles[appointment.veiculoId || ''] ? 
                        `${vehicles[appointment.veiculoId || ''].brand} ${vehicles[appointment.veiculoId || ''].model} (${vehicles[appointment.veiculoId || ''].plate})` : 
                        'Veículo não encontrado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-bold">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover/item:bg-white dark:group-hover/item:bg-slate-900 transition-colors">
                      <ClipboardList size={18} className="text-slate-400" />
                    </div>
                    <span className="truncate max-w-[300px]">
                      {appointment.servicoIds.map(id => services[id]).filter(Boolean).join(', ') || 'Nenhum serviço'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-[3rem] border border-dashed border-border">
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-sm mb-6 group-hover:rotate-12 transition-transform duration-700 border border-border">
              <Calendar size={48} className="text-slate-200 dark:text-slate-800" />
            </div>
            <h4 className="text-xl font-black text-slate-800 dark:text-white mb-2 font-display">Nenhum agendamento para hoje</h4>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sua agenda está livre por enquanto.</p>
          </div>
        )}
      </div>
    </Card>
  );
};

