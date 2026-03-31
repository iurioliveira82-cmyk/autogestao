import React from 'react';
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ServiceOrder, OSStatus } from '../../../types';
import { cn, formatCurrency } from '../../../utils';

interface RecentOSProps {
  recentOS: ServiceOrder[];
  clients: Record<string, string>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  handleUpdateStatus: (os: ServiceOrder, newStatus: OSStatus) => void;
  setActiveTab?: (tab: string) => void;
}

export const RecentOS: React.FC<RecentOSProps> = ({ 
  recentOS, 
  clients, 
  selectedDate, 
  setSelectedDate, 
  handleUpdateStatus, 
  setActiveTab 
}) => {
  return (
    <div className="modern-card !p-0 overflow-hidden group">
      <div className="p-10 sm:p-16 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-10">
          <div>
            <h3 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight font-display">Ordens de Serviço</h3>
            <p className="text-base sm:text-lg text-zinc-500 font-medium mt-2">Acompanhamento das Ordens de Serviço por data</p>
          </div>
          <div className="flex items-center gap-4 bg-zinc-50 px-6 py-3 rounded-2xl border border-zinc-100 shadow-sm focus-within:ring-2 focus-within:ring-accent/20 transition-all">
            <Calendar size={20} className="text-zinc-400" />
            <input 
              type="date" 
              className="bg-transparent border-none text-sm font-black text-zinc-700 focus:ring-0 p-0 uppercase tracking-widest"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
        <button 
          onClick={() => setActiveTab?.('os')}
          className="w-full sm:w-auto px-10 py-4 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all shadow-xl shadow-zinc-900/10"
        >
          Ver todas as OS
        </button>
      </div>
      
      {/* Mobile View: List of Cards */}
      <div className="block sm:hidden divide-y divide-zinc-100">
        {recentOS.length > 0 ? recentOS.map((os) => (
          <div key={os.id} className="p-8 space-y-6 hover:bg-zinc-50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-black text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-xl">
                #{os.id.slice(0, 8).toUpperCase()}
              </span>
              <span className={cn(
                "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border",
                ['em_execucao', 'aprovada'].includes(os.status) ? "bg-blue-50 text-blue-600 border-blue-100" : 
                os.status === 'finalizada' ? "bg-green-50 text-green-600 border-green-100" :
                os.status === 'cancelada' ? "bg-red-50 text-red-600 border-red-100" :
                "bg-zinc-100 text-zinc-600 border border-zinc-200"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", ['em_execucao', 'aprovada'].includes(os.status) ? "bg-blue-600 animate-pulse" : os.status === 'finalizada' ? "bg-green-600" : os.status === 'cancelada' ? "bg-red-600" : "bg-zinc-400")} />
                {os.status === 'em_execucao' ? 'Em Execução' : os.status === 'finalizada' ? 'Finalizado' : os.status === 'cancelada' ? 'Cancelado' : os.status === 'aprovada' ? 'Aprovada' : 'Aguardando'}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-accent/20">
                {(clients[os.clienteId] || 'C').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black text-zinc-900">{clients[os.clienteId] || `Cliente ${os.clienteId.slice(0, 4)}`}</span>
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Pessoa Física</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Abertura</span>
                <span className="text-sm font-black text-zinc-600">{format(new Date(os.createdAt), 'dd/MM/yyyy')}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Total</span>
                <p className="text-lg font-black text-zinc-900 font-display">{formatCurrency(os.valorTotal)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4">
              <button 
                onClick={() => handleUpdateStatus(os, 'em_execucao')}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all",
                  os.status === 'em_execucao' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                )}
              >
                <Clock size={16} />
                Andamento
              </button>
              <button 
                onClick={() => handleUpdateStatus(os, 'finalizada')}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all",
                  os.status === 'finalizada' ? "bg-green-600 text-white shadow-lg shadow-green-600/20" : "bg-green-50 text-green-600 hover:bg-green-100"
                )}
              >
                <CheckCircle2 size={16} />
                Finalizar
              </button>
              <button 
                onClick={() => handleUpdateStatus(os, 'cancelada')}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all",
                  os.status === 'cancelada' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "bg-red-50 text-red-600 hover:bg-red-100"
                )}
              >
                <XCircle size={16} />
                Cancelar
              </button>
            </div>
          </div>
        )) : (
          <div className="p-16 text-center">
            <p className="text-xs text-zinc-400 font-black uppercase tracking-[0.3em]">Nenhuma OS para esta data</p>
          </div>
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em]">
              <th className="px-12 py-8">Identificador</th>
              <th className="px-12 py-8">Cliente</th>
              <th className="px-12 py-8">Status Atual</th>
              <th className="px-12 py-8">Valor Total</th>
              <th className="px-12 py-8">Ações Rápidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {recentOS.map((os) => (
              <tr key={os.id} className="group/row hover:bg-zinc-50/80 transition-all duration-300">
                <td className="px-12 py-8">
                  <span className="font-mono text-[11px] font-black text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-xl group-hover/row:bg-white transition-colors">
                    #{os.id.slice(0, 8).toUpperCase()}
                  </span>
                </td>
                <td className="px-12 py-8">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-accent/10 group-hover/row:scale-110 transition-transform">
                      {(clients[os.clienteId] || 'C').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base font-black text-zinc-900 group-hover/row:text-accent transition-colors">{clients[os.clienteId] || `Cliente ${os.clienteId.slice(0, 4)}`}</span>
                      <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Pessoa Física</span>
                    </div>
                  </div>
                </td>
                <td className="px-12 py-8">
                  <span className={cn(
                    "inline-flex items-center gap-3 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border",
                    ['em_execucao', 'aprovada'].includes(os.status) ? "bg-blue-50 text-blue-600 border-blue-100" : 
                    os.status === 'finalizada' ? "bg-green-50 text-green-600 border-green-100" :
                    os.status === 'cancelada' ? "bg-red-50 text-red-600 border-red-100" :
                    "bg-zinc-100 text-zinc-600 border border-zinc-200"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full", ['em_execucao', 'aprovada'].includes(os.status) ? "bg-blue-600 animate-pulse" : os.status === 'finalizada' ? "bg-green-600" : os.status === 'cancelada' ? "bg-red-600" : "bg-zinc-400")} />
                    {os.status === 'em_execucao' ? 'Em Execução' : os.status === 'finalizada' ? 'Finalizado' : os.status === 'cancelada' ? 'Cancelado' : os.status === 'aprovada' ? 'Aprovada' : 'Aguardando'}
                  </span>
                </td>
                <td className="px-12 py-8">
                  <span className="text-lg font-black text-zinc-900 font-display">{formatCurrency(os.valorTotal)}</span>
                </td>
                <td className="px-12 py-8">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleUpdateStatus(os, 'em_execucao')}
                      className={cn(
                        "p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95",
                        os.status === 'em_execucao' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      )}
                      title="Em Andamento"
                    >
                      <Clock size={18} />
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(os, 'finalizada')}
                      className={cn(
                        "p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95",
                        os.status === 'finalizada' ? "bg-green-600 text-white shadow-lg shadow-green-600/20" : "bg-green-50 text-green-600 hover:bg-green-100"
                      )}
                      title="Finalizar"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(os, 'cancelada')}
                      className={cn(
                        "p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95",
                        os.status === 'cancelada' ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "bg-red-50 text-red-600 hover:bg-red-100"
                      )}
                      title="Cancelar"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
