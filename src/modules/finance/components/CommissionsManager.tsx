import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Clock,
  Download
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Commission, OperationType, UserProfile } from '../../../types';
import { useAuth } from '../../auth/Auth';
import { formatCurrency, cn, handleFirestoreError } from '../../../utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { usePermissions } from '../../../hooks/usePermissions';

const CommissionsManager: React.FC = () => {
  const { profile } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { canEdit } = usePermissions('finance');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToPay, setItemToPay] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'pending' | 'paid',
    tecnicoId: 'all',
    searchTerm: ''
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const q = query(
      collection(db, 'comissoes'),
      where('empresaId', '==', profile.empresaId),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Commission[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Commission));
      setCommissions(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'comissoes');
      setLoading(false);
    });

    const unsubscribeTechs = onSnapshot(
      query(collection(db, 'usuarios'), where('empresaId', '==', profile.empresaId), where('role', '==', 'tecnico')),
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => list.push({ uid: doc.id, ...doc.data() } as UserProfile));
        setTechnicians(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'usuarios')
    );

    return () => {
      unsubscribe();
      unsubscribeTechs();
    };
  }, [profile]);

  const handleMarkAsPaid = async (id: string) => {
    setItemToPay(id);
    setIsConfirmOpen(true);
  };

  const confirmPayment = async () => {
    if (!itemToPay) return;
    try {
      await updateDoc(doc(db, 'comissoes', itemToPay), {
        status: 'paid',
        paidAt: serverTimestamp()
      });
      toast.success('Comissão marcada como paga!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar comissão');
    } finally {
      setIsConfirmOpen(false);
      setItemToPay(null);
    }
  };

  const filtered = commissions.filter(c => {
    const matchesStatus = filters.status === 'all' || c.status === filters.status;
    const matchesTech = filters.tecnicoId === 'all' || c.tecnicoId === filters.tecnicoId;
    const matchesSearch = c.servicoNome.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                          c.osNumero.toString().includes(filters.searchTerm);
    return matchesStatus && matchesTech && matchesSearch;
  });

  const summary = {
    total: filtered.reduce((acc, c) => acc + c.valorComissao, 0),
    pending: filtered.filter(c => c.status === 'pending').reduce((acc, c) => acc + c.valorComissao, 0),
    paid: filtered.filter(c => c.status === 'paid').reduce((acc, c) => acc + c.valorComissao, 0)
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">Gestão de Comissões</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Acompanhamento de Produtividade</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            icon={<Download size={18} />}
          >
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Filtrado</p>
          <h3 className="text-2xl font-black text-slate-900">{formatCurrency(summary.total)}</h3>
        </Card>
        <Card className="p-6 bg-amber-50 border-amber-100">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Pendente</p>
          <h3 className="text-2xl font-black text-amber-700">{formatCurrency(summary.pending)}</h3>
        </Card>
        <Card className="p-6 bg-green-50 border-green-100">
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Pago</p>
          <h3 className="text-2xl font-black text-green-700">{formatCurrency(summary.paid)}</h3>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <SearchBar 
              placeholder="Buscar por OS ou serviço..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <select 
              className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              value={filters.tecnicoId}
              onChange={(e) => setFilters({ ...filters, tecnicoId: e.target.value })}
            >
              <option value="all">Todos Técnicos</option>
              {technicians.map(t => (
                <option key={t.uid} value={t.uid}>{t.name}</option>
              ))}
            </select>

            <div className="flex p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setFilters({ ...filters, status: 'all' })}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filters.status === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setFilters({ ...filters, status: 'pending' })}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filters.status === 'pending' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Pendentes
              </button>
              <button
                onClick={() => setFilters({ ...filters, status: 'paid' })}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filters.status === 'paid' ? "bg-white text-green-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Pagos
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-8 py-4">Data</th>
                <th className="px-8 py-4">Técnico</th>
                <th className="px-8 py-4">OS / Serviço</th>
                <th className="px-8 py-4 text-right">Valor Serv.</th>
                <th className="px-8 py-4 text-right">Comissão (%)</th>
                <th className="px-8 py-4 text-right">Valor Comis.</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-8 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{format(new Date(c.timestamp), 'dd/MM/yyyy')}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{format(new Date(c.timestamp), 'HH:mm')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-xs">
                        {technicians.find(t => t.uid === c.tecnicoId)?.name?.charAt(0) || 'T'}
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {technicians.find(t => t.uid === c.tecnicoId)?.name || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">OS #{c.osNumero}</span>
                      <span className="text-xs text-slate-500 font-medium">{c.servicoNome}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right text-sm font-medium text-slate-600">
                    {formatCurrency(c.valorServico)}
                  </td>
                  <td className="px-8 py-4 text-right text-sm font-black text-slate-400">
                    {c.percentualComissao}%
                  </td>
                  <td className="px-8 py-4 text-right text-sm font-black text-slate-900">
                    {formatCurrency(c.valorComissao)}
                  </td>
                  <td className="px-8 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      c.status === 'paid' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {c.status === 'paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {c.status === 'paid' ? 'Pago' : 'Pendente'}
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    {c.status === 'pending' && canEdit && (
                      <Button 
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkAsPaid(c.id!)}
                        icon={<CheckCircle2 size={18} />}
                        className="text-slate-400 hover:text-green-600 hover:bg-green-50"
                        title="Marcar como Pago"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmPayment}
        title="Confirmar Pagamento"
        message="Deseja marcar esta comissão como paga?"
      />
    </div>
  );
};

export default CommissionsManager;
