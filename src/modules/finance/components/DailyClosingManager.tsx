import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle,
  Lock,
  Unlock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { DailyClosing, OperationType, FinancialTransaction, ServiceOrder } from '../../../types';
import { useAuth } from '../../auth/Auth';
import { formatCurrency, cn, handleFirestoreError, formatSafeDate } from '../../../utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import SectionCard from '../../../components/layout/SectionCard';
import { DataTable } from '../../../components/ui/DataTable';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { usePermissions } from '../../../hooks/usePermissions';

const DailyClosingManager: React.FC = () => {
  const { profile } = useAuth();
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const { canCreate } = usePermissions('finance');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [todayStats, setTodayStats] = useState({
    faturamentoBruto: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    osFinalizadas: 0,
    ticketMedio: 0
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'fechamentos_diarios'),
      where('empresaId', '==', profile.empresaId),
      orderBy('date', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DailyClosing[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as DailyClosing));
      setClosings(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'fechamentos_diarios');
      setLoading(false);
    });

    // Fetch today's real-time stats
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    const unsubscribeTransactions = onSnapshot(
      query(collection(db, 'transacoes_financeiras'), where('empresaId', '==', profile.empresaId), where('status', '==', 'paid')),
      (snapshot) => {
        let entries = 0;
        let exits = 0;
        snapshot.forEach(doc => {
          const data = doc.data() as FinancialTransaction;
          const date = new Date(data.date);
          if (date >= start && date <= end) {
            if (data.type === 'in') entries += data.value;
            else exits += data.value;
          }
        });
        setTodayStats(prev => ({ ...prev, totalEntradas: entries, totalSaidas: exits }));
      }
    );

    const unsubscribeOS = onSnapshot(
      query(collection(db, 'ordens_servico'), where('empresaId', '==', profile.empresaId), where('status', '==', 'finalizada')),
      (snapshot) => {
        let count = 0;
        let total = 0;
        snapshot.forEach(doc => {
          const data = doc.data() as ServiceOrder;
          const date = new Date(data.updatedAt || data.createdAt);
          if (date >= start && date <= end) {
            count++;
            total += data.valorTotal || 0;
          }
        });
        setTodayStats(prev => ({ 
          ...prev, 
          osFinalizadas: count, 
          faturamentoBruto: total,
          ticketMedio: count > 0 ? total / count : 0
        }));
      }
    );

    return () => {
      unsubscribe();
      unsubscribeTransactions();
      unsubscribeOS();
    };
  }, [profile]);

  const handleCloseDay = async () => {
    const todayStr = formatSafeDate(new Date(), 'yyyy-MM-dd');
    const alreadyClosed = closings.some(c => c.date === todayStr);
    
    if (alreadyClosed) return toast.error('O dia de hoje já foi fechado!');
    setIsConfirmOpen(true);
  };

  const confirmCloseDay = async () => {
    const todayStr = formatSafeDate(new Date(), 'yyyy-MM-dd');
    try {
      await addDoc(collection(db, 'fechamentos_diarios'), {
        empresaId: profile.empresaId,
        date: todayStr,
        faturamentoBruto: todayStats.faturamentoBruto,
        totalEntradas: todayStats.totalEntradas,
        totalSaidas: todayStats.totalSaidas,
        saldoFinal: todayStats.totalEntradas - todayStats.totalSaidas,
        osFinalizadas: todayStats.osFinalizadas,
        ticketMedio: todayStats.ticketMedio,
        usuarioId: profile.uid,
        status: 'closed',
        createdAt: serverTimestamp()
      });
      toast.success('Dia fechado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao fechar o dia');
    } finally {
      setIsConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">Fechamento Diário</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Conciliação de Movimentações</p>
        </div>
        {canCreate && (
          <AppButton 
            onClick={handleCloseDay}
            icon={<Lock size={18} />}
            className="shadow-lg shadow-slate-200"
          >
            Fechar Dia Hoje
          </AppButton>
        )}
      </div>

      {/* Today's Live Preview */}
      <SectionCard 
        title="Resumo de Hoje (Aberto)" 
        subtitle={formatSafeDate(new Date(), "dd 'de' MMMM")}
        icon={<Unlock size={20} className="text-accent" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Entradas (Caixa)</p>
            <p className="text-2xl font-black text-green-600">{formatCurrency(todayStats.totalEntradas)}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saídas (Caixa)</p>
            <p className="text-2xl font-black text-red-600">{formatCurrency(todayStats.totalSaidas)}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">OS Finalizadas</p>
            <p className="text-2xl font-black text-slate-900">{todayStats.osFinalizadas}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ticket Médio</p>
            <p className="text-2xl font-black text-accent">{formatCurrency(todayStats.ticketMedio)}</p>
          </div>
        </div>
      </SectionCard>

      {/* History Table */}
      <SectionCard 
        title="Histórico de Fechamentos" 
        subtitle="Últimos 30 dias"
      >
        <DataTable
          isLoading={loading}
          columns={[
            { header: 'Data', accessor: (c) => (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-900">{formatSafeDate(c.date + 'T12:00:00', 'dd/MM/yyyy')}</span>
              </div>
            )},
            { header: 'Entradas', className: 'text-right', accessor: (c) => (
              <span className="text-sm font-black text-green-600">{formatCurrency(c.totalEntradas)}</span>
            )},
            { header: 'Saídas', className: 'text-right', accessor: (c) => (
              <span className="text-sm font-black text-red-600">{formatCurrency(c.totalSaidas)}</span>
            )},
            { header: 'Saldo', className: 'text-right', accessor: (c) => (
              <span className="text-sm font-black text-slate-900">{formatCurrency(c.saldoFinal)}</span>
            )},
            { header: 'OS', className: 'text-center', accessor: (c) => (
              <span className="text-sm font-bold text-slate-600">{c.osFinalizadas}</span>
            )},
            { header: 'Ticket Médio', className: 'text-right', accessor: (c) => (
              <span className="text-sm font-bold text-accent">{formatCurrency(c.ticketMedio)}</span>
            )},
            { header: 'Status', accessor: (c) => (
              <StatusBadge 
                status="closed" 
                label="Fechado"
                icon={<Lock size={12} />}
              />
            )}
          ]}
          data={closings}
          emptyMessage="Nenhum fechamento encontrado."
        />
      </SectionCard>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmCloseDay}
        title="Fechar Dia"
        message="Deseja realizar o fechamento do dia agora? Esta ação registrará todos os valores atuais e não poderá ser desfeita."
      />
    </div>
  );
};

export default DailyClosingManager;
