import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  CheckCircle2, 
  Clock,
  DollarSign,
  FileText,
  Filter,
  Download
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Commission, OperationType, UserProfile } from '../../../types';
import { useAuth } from '../../auth/Auth';
import { formatCurrency, cn, handleFirestoreError } from '../../../utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const CommissionsManager: React.FC = () => {
  const { profile } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!window.confirm('Confirmar pagamento desta comissão?')) return;
    try {
      await updateDoc(doc(db, 'comissoes', id), {
        status: 'paid',
        paidAt: serverTimestamp()
      });
      toast.success('Comissão marcada como paga!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar comissão');
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
          <h3 className="text-xl font-black text-zinc-900">Gestão de Comissões</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Acompanhamento de Produtividade</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-all">
            <Download size={18} />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Filtrado</p>
          <h3 className="text-2xl font-black text-zinc-900">{formatCurrency(summary.total)}</h3>
        </div>
        <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 shadow-sm">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Pendente</p>
          <h3 className="text-2xl font-black text-amber-700">{formatCurrency(summary.pending)}</h3>
        </div>
        <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100 shadow-sm">
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Pago</p>
          <h3 className="text-2xl font-black text-green-700">{formatCurrency(summary.paid)}</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por OS ou serviço..."
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <select 
              className="px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              value={filters.tecnicoId}
              onChange={(e) => setFilters({ ...filters, tecnicoId: e.target.value })}
            >
              <option value="all">Todos Técnicos</option>
              {technicians.map(t => (
                <option key={t.uid} value={t.uid}>{t.name}</option>
              ))}
            </select>

            <div className="flex p-1 bg-zinc-100 rounded-2xl">
              <button
                onClick={() => setFilters({ ...filters, status: 'all' })}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filters.status === 'all' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setFilters({ ...filters, status: 'pending' })}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filters.status === 'pending' ? "bg-white text-amber-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Pendentes
              </button>
              <button
                onClick={() => setFilters({ ...filters, status: 'paid' })}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filters.status === 'paid' ? "bg-white text-green-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                Pagos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
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
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-all group">
                  <td className="px-8 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-900">{format(new Date(c.timestamp), 'dd/MM/yyyy')}</span>
                      <span className="text-[10px] text-zinc-400 font-medium">{format(new Date(c.timestamp), 'HH:mm')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-xs">
                        {technicians.find(t => t.uid === c.tecnicoId)?.name?.charAt(0) || 'T'}
                      </div>
                      <span className="text-sm font-bold text-zinc-900">
                        {technicians.find(t => t.uid === c.tecnicoId)?.name || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-zinc-900">OS #{c.osNumero}</span>
                      <span className="text-xs text-zinc-500 font-medium">{c.servicoNome}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right text-sm font-medium text-zinc-600">
                    {formatCurrency(c.valorServico)}
                  </td>
                  <td className="px-8 py-4 text-right text-sm font-black text-zinc-400">
                    {c.percentualComissao}%
                  </td>
                  <td className="px-8 py-4 text-right text-sm font-black text-zinc-900">
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
                    {c.status === 'pending' && (
                      <button 
                        onClick={() => handleMarkAsPaid(c.id!)}
                        className="p-2 text-zinc-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                        title="Marcar como Pago"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
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

export default CommissionsManager;
