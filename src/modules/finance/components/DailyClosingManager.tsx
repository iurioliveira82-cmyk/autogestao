import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
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
import { formatCurrency, cn, handleFirestoreError } from '../../../utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const DailyClosingManager: React.FC = () => {
  const { profile } = useAuth();
  const [closings, setClosings] = useState<DailyClosing[]>([]);
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
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const alreadyClosed = closings.some(c => c.date === todayStr);
    
    if (alreadyClosed) return toast.error('O dia de hoje já foi fechado!');
    if (!window.confirm('Deseja realizar o fechamento do dia agora?')) return;

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
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-zinc-900">Fechamento Diário</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Conciliação de Movimentações</p>
        </div>
        <button 
          onClick={handleCloseDay}
          className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-zinc-200"
        >
          <Lock size={18} />
          Fechar Dia Hoje
        </button>
      </div>

      {/* Today's Live Preview */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-accent/10 text-accent rounded-2xl">
            <Unlock size={24} />
          </div>
          <div>
            <h4 className="text-lg font-black text-zinc-900">Resumo de Hoje (Aberto)</h4>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Entradas (Caixa)</p>
            <p className="text-2xl font-black text-green-600">{formatCurrency(todayStats.totalEntradas)}</p>
          </div>
          <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Saídas (Caixa)</p>
            <p className="text-2xl font-black text-red-600">{formatCurrency(todayStats.totalSaidas)}</p>
          </div>
          <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">OS Finalizadas</p>
            <p className="text-2xl font-black text-zinc-900">{todayStats.osFinalizadas}</p>
          </div>
          <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Ticket Médio</p>
            <p className="text-2xl font-black text-accent">{formatCurrency(todayStats.ticketMedio)}</p>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100">
          <h4 className="text-lg font-black text-zinc-900">Histórico de Fechamentos</h4>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Últimos 30 dias</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-8 py-4">Data</th>
                <th className="px-8 py-4 text-right">Entradas</th>
                <th className="px-8 py-4 text-right">Saídas</th>
                <th className="px-8 py-4 text-right">Saldo</th>
                <th className="px-8 py-4 text-center">OS</th>
                <th className="px-8 py-4 text-right">Ticket Médio</th>
                <th className="px-8 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {closings.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-all group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-zinc-400" />
                      <span className="text-sm font-bold text-zinc-900">{format(new Date(c.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right text-sm font-black text-green-600">{formatCurrency(c.totalEntradas)}</td>
                  <td className="px-8 py-4 text-right text-sm font-black text-red-600">{formatCurrency(c.totalSaidas)}</td>
                  <td className="px-8 py-4 text-right text-sm font-black text-zinc-900">{formatCurrency(c.saldoFinal)}</td>
                  <td className="px-8 py-4 text-center text-sm font-bold text-zinc-600">{c.osFinalizadas}</td>
                  <td className="px-8 py-4 text-right text-sm font-bold text-accent">{formatCurrency(c.ticketMedio)}</td>
                  <td className="px-8 py-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <Lock size={12} />
                      Fechado
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyClosingManager;
