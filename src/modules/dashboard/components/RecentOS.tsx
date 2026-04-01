import React from 'react';
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ServiceOrder, OSStatus } from '../../../types';
import { cn, formatCurrency } from '../../../utils';
import { Table, Badge, Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

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
        return <Badge variant="info">Em Execução</Badge>;
      case 'finalizada':
        return <Badge variant="success">Finalizado</Badge>;
      case 'cancelada':
        return <Badge variant="danger">Cancelado</Badge>;
      default:
        return <Badge variant="neutral">Aguardando</Badge>;
    }
  };

  return (
    <Card className="!p-0 overflow-hidden group">
      <div className="p-8 sm:p-12 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-8 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-8">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight font-display">Ordens de Serviço</h3>
            <p className="text-sm text-zinc-500 font-medium mt-1">Acompanhamento das Ordens de Serviço por data</p>
          </div>
          <div className="w-full sm:w-64">
            <Input 
              type="date" 
              icon={<Calendar size={18} />}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="!py-3"
            />
          </div>
        </div>
        <Button 
          onClick={() => setActiveTab?.('os')}
          className="w-full sm:w-auto"
        >
          Ver todas as OS
        </Button>
      </div>
      
      {/* Mobile View: List of Cards */}
      <div className="block sm:hidden divide-y divide-border">
        {recentOS.length > 0 ? recentOS.map((os) => (
          <div key={os.id} className="p-8 space-y-6 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-black text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">
                #{os.id.slice(0, 8).toUpperCase()}
              </span>
              {getStatusBadge(os.status)}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-accent/20">
                {(clients[os.clienteId] || 'C').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black text-zinc-900 dark:text-white">{clients[os.clienteId] || `Cliente ${os.clienteId.slice(0, 4)}`}</span>
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Pessoa Física</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Abertura</span>
                <span className="text-sm font-black text-zinc-600 dark:text-zinc-400">{format(new Date(os.createdAt), 'dd/MM/yyyy')}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Total</span>
                <p className="text-lg font-black text-zinc-900 dark:text-white font-display">{formatCurrency(os.valorTotal)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4">
              <Button 
                variant={os.status === 'em_execucao' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleUpdateStatus(os, 'em_execucao')}
                className="flex-col !py-4 gap-2 h-auto"
              >
                <Clock size={16} />
                <span className="text-[8px]">Andamento</span>
              </Button>
              <Button 
                variant={os.status === 'finalizada' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handleUpdateStatus(os, 'finalizada')}
                className="flex-col !py-4 gap-2 h-auto"
              >
                <CheckCircle2 size={16} />
                <span className="text-[8px]">Finalizar</span>
              </Button>
              <Button 
                variant={os.status === 'cancelada' ? 'danger' : 'outline'}
                size="sm"
                onClick={() => handleUpdateStatus(os, 'cancelada')}
                className="flex-col !py-4 gap-2 h-auto"
              >
                <XCircle size={16} />
                <span className="text-[8px]">Cancelar</span>
              </Button>
            </div>
          </div>
        )) : (
          <div className="p-16 text-center">
            <p className="text-xs text-zinc-400 font-black uppercase tracking-[0.3em]">Nenhuma OS para esta data</p>
          </div>
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden sm:block p-8">
        <Table 
          headers={['Identificador', 'Cliente', 'Status Atual', 'Valor Total', 'Ações Rápidas']}
        >
          {recentOS.map((os) => (
            <tr key={os.id} className="group/row">
              <td className="px-6 py-4">
                <span className="font-mono text-[11px] font-black text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl group-hover/row:bg-white dark:group-hover/row:bg-zinc-950 transition-colors">
                  #{os.id.slice(0, 8).toUpperCase()}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent text-accent-foreground rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-accent/10 group-hover/row:scale-110 transition-transform">
                    {(clients[os.clienteId] || 'C').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-zinc-900 dark:text-white group-hover/row:text-accent transition-colors">{clients[os.clienteId] || `Cliente ${os.clienteId.slice(0, 4)}`}</span>
                    <span className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.2em]">Pessoa Física</span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                {getStatusBadge(os.status)}
              </td>
              <td className="px-6 py-4">
                <span className="text-base font-black text-zinc-900 dark:text-white font-display">{formatCurrency(os.valorTotal)}</span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUpdateStatus(os, 'em_execucao')}
                    className={cn(os.status === 'em_execucao' && "bg-blue-500/10 text-blue-500")}
                    title="Em Andamento"
                  >
                    <Clock size={18} />
                  </Button>
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUpdateStatus(os, 'finalizada')}
                    className={cn(os.status === 'finalizada' && "bg-green-500/10 text-green-500")}
                    title="Finalizar"
                  >
                    <CheckCircle2 size={18} />
                  </Button>
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUpdateStatus(os, 'cancelada')}
                    className={cn(os.status === 'cancelada' && "bg-red-500/10 text-red-500")}
                    title="Cancelar"
                  >
                    <XCircle size={18} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </Card>
  );
};

