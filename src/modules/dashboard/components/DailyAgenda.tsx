import React from 'react';
import { Calendar, ArrowUpRight, Car, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { Appointment, Vehicle } from '../../../types';
import { formatSafeDate, cn } from '../../../utils';
import SectionCard from '../../../components/layout/SectionCard';
import { AppButton } from '../../../components/ui/AppButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import EmptyState from '../../../components/layout/EmptyState';

interface DailyAgendaProps {
  appointments: Appointment[];
  clients: Record<string, string>;
  vehicles: Record<string, Vehicle>;
  services: Record<string, string>;
  setActiveTab?: (tab: string) => void;
}

export const DailyAgenda: React.FC<DailyAgendaProps> = ({ appointments, clients, vehicles, services, setActiveTab }) => {
  return (
    <SectionCard 
      title="Agenda do Dia" 
      subtitle="Compromissos agendados para hoje"
      actions={
        <AppButton 
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab?.('agenda')}
          icon={<ArrowUpRight size={16} />}
        >
          Ver Agenda
        </AppButton>
      }
      className="h-full"
    >
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {appointments.length > 0 ? (
          appointments.map((appointment) => (
            <div 
              key={appointment.id} 
              className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary/20 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all duration-300 group/item"
            >
              <div className="flex flex-col items-center justify-center min-w-[64px] py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl border border-slate-100 dark:border-slate-800 group-hover/item:bg-primary group-hover/item:text-white group-hover/item:border-primary transition-all duration-300">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  {formatSafeDate(appointment.startTime, 'HH:mm')}
                </span>
                <div className="w-4 h-px bg-current opacity-20 my-1" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  {formatSafeDate(appointment.endTime, 'HH:mm')}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate group-hover/item:text-primary transition-colors font-display">
                    {clients[appointment.clienteId] || 'Cliente não encontrado'}
                  </h4>
                  <StatusBadge 
                    label={appointment.status === 'confirmed' ? 'Confirmado' : appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                    variant={appointment.status === 'confirmed' ? 'success' : appointment.status === 'cancelled' ? 'danger' : 'info'}
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
                    <Car size={14} className="text-slate-400" />
                    <span className="truncate">
                      {vehicles[appointment.veiculoId || ''] ? 
                        `${vehicles[appointment.veiculoId || ''].brand} ${vehicles[appointment.veiculoId || ''].model} (${vehicles[appointment.veiculoId || ''].plate})` : 
                        'Veículo não encontrado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
                    <ClipboardList size={14} className="text-slate-400" />
                    <span className="truncate">
                      {appointment.servicoIds.map(id => services[id]).filter(Boolean).join(', ') || 'Nenhum serviço'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState 
            icon={Calendar}
            title="Agenda livre"
            description="Nenhum agendamento para hoje."
            className="py-12 border-none bg-transparent"
          />
        )}
      </div>
    </SectionCard>
  );
};

