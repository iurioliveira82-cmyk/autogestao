import React from 'react';
import { Calendar, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ServiceOrder, OSStatus } from '../../../types';
import { cn, formatCurrency } from '../../../utils';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AppCard } from '../../../components/ui/AppCard';
import { AppButton } from '../../../components/ui/AppButton';
import { AppInput } from '../../../components/ui/AppInput';

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
  const getStatusBadge = (status: OSStatus) => {
    switch (status) {
      case 'em_execucao':
      case 'aprovada':
        return <StatusBadge label="Em Execução" variant="info" />;
      case 'finalizada':
        return <StatusBadge label="Finalizado" variant="success" />;
      case 'cancelada':
        return <StatusBadge label="Cancelado" variant="danger" />;
      default:
        return <StatusBadge label="Aguardando" variant="neutral" />;
    }
  };

  return (
    <AppCard className="!p-0 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-48">
            <AppInput 
              type="date" 
              icon={<Calendar size={16} />}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="!py-2"
            />
          </div>
        </div>
        <AppButton 
          variant="outline"
          size="sm"
          onClick={() => setActiveTab?.('os')}
          icon={<ArrowRight size={16} />}
        >
          Ver todas as OS
        </AppButton>
      </div>
      
      <DataTable
        headers={['Identificador', 'Cliente', 'Status', 'Total', 'Ações']}
        data={recentOS}
        className="border-none shadow-none rounded-none"
        renderRow={(os) => (
          <>
            <td className="px-6 py-4">
              <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                #{os.id.slice(0, 8).toUpperCase()}
              </span>
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold text-[10px] border border-slate-200">
                  {(clients[os.clienteId] || 'C').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{clients[os.clienteId] || `Cliente ${os.clienteId.slice(0, 4)}`}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pessoa Física</span>
                </div>
              </div>
            </td>
            <td className="px-6 py-4">
              {getStatusBadge(os.status)}
            </td>
            <td className="px-6 py-4">
              <span className="text-sm font-black text-slate-900 font-display">{formatCurrency(os.valorTotal)}</span>
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-1">
                <AppButton 
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdateStatus(os, 'em_execucao')}
                  className={cn("w-8 h-8 !p-0", os.status === 'em_execucao' && "bg-blue-50 text-blue-600")}
                  title="Em Andamento"
                >
                  <Clock size={16} />
                </AppButton>
                <AppButton 
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdateStatus(os, 'finalizada')}
                  className={cn("w-8 h-8 !p-0", os.status === 'finalizada' && "bg-emerald-50 text-emerald-600")}
                  title="Finalizar"
                >
                  <CheckCircle2 size={16} />
                </AppButton>
                <AppButton 
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdateStatus(os, 'cancelada')}
                  className={cn("w-8 h-8 !p-0", os.status === 'cancelada' && "bg-rose-50 text-rose-600")}
                  title="Cancelar"
                >
                  <XCircle size={16} />
                </AppButton>
              </div>
            </td>
          </>
        )}
      />
    </AppCard>
  );
};

