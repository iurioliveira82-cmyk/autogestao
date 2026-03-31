import React from 'react';
import { Calendar, ArrowUpRight, Car, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { Appointment, Vehicle } from '../../../types';
import { cn } from '../../../utils';

interface DailyAgendaProps {
  appointments: Appointment[];
  clients: Record<string, string>;
  vehicles: Record<string, Vehicle>;
  services: Record<string, string>;
  setActiveTab?: (tab: string) => void;
}

export const DailyAgenda: React.FC<DailyAgendaProps> = ({ appointments, clients, vehicles, services, setActiveTab }) => {
  return (
    <div className="lg:col-span-2 modern-card !p-10 sm:!p-16 group">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12">
        <div>
          <h3 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight font-display">Agenda do Dia</h3>
          <p className="text-base sm:text-lg text-zinc-500 font-medium mt-2">Compromissos agendados para hoje</p>
        </div>
        <button 
          onClick={() => setActiveTab?.('agenda')}
          className="flex items-center gap-3 px-6 py-3 bg-zinc-50 text-zinc-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-100 transition-all border border-zinc-100 shadow-sm group/btn"
        >
          Ver Agenda Completa
          <ArrowUpRight size={18} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
        </button>
      </div>

      <div className="space-y-8 max-h-[600px] overflow-y-auto pr-6 custom-scrollbar">
        {appointments.length > 0 ? (
          appointments.map((appointment) => (
            <div 
              key={appointment.id} 
              className="flex items-start gap-8 p-8 rounded-[2.5rem] border border-zinc-50 hover:border-accent/30 hover:bg-zinc-50/50 transition-all duration-500 group/item"
            >
              <div className="flex flex-col items-center justify-center min-w-[80px] py-4 bg-zinc-50 text-zinc-900 rounded-3xl shadow-sm group-hover/item:bg-accent group-hover/item:text-accent-foreground transition-all duration-500">
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
                  <h4 className="text-xl font-black text-zinc-900 truncate group-hover/item:text-accent transition-colors font-display">
                    {clients[appointment.clienteId] || 'Cliente não encontrado'}
                  </h4>
                  <span className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border",
                    appointment.status === 'confirmed' ? "bg-green-50 text-green-600 border-green-100" :
                    appointment.status === 'cancelled' ? "bg-red-50 text-red-600 border-red-100" :
                    "bg-blue-50 text-blue-600 border-blue-100"
                  )}>
                    {appointment.status === 'confirmed' ? 'Confirmado' : 
                     appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <div className="flex items-center gap-3 text-sm text-zinc-500 font-bold">
                    <div className="p-2 bg-zinc-100 rounded-xl group-hover/item:bg-white transition-colors">
                      <Car size={18} className="text-zinc-400" />
                    </div>
                    <span>
                      {vehicles[appointment.veiculoId || ''] ? 
                        `${vehicles[appointment.veiculoId || ''].brand} ${vehicles[appointment.veiculoId || ''].model} (${vehicles[appointment.veiculoId || ''].plate})` : 
                        'Veículo não encontrado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-500 font-bold">
                    <div className="p-2 bg-zinc-100 rounded-xl group-hover/item:bg-white transition-colors">
                      <ClipboardList size={18} className="text-zinc-400" />
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
          <div className="flex flex-col items-center justify-center py-24 text-center bg-zinc-50/50 rounded-[3rem] border border-dashed border-zinc-200">
            <div className="p-8 bg-white rounded-3xl shadow-sm mb-6 group-hover:rotate-12 transition-transform duration-700">
              <Calendar size={48} className="text-zinc-200" />
            </div>
            <h4 className="text-xl font-black text-zinc-900 mb-2 font-display">Nenhum agendamento para hoje</h4>
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Sua agenda está livre por enquanto.</p>
          </div>
        )}
      </div>
    </div>
  );
};
