import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Settings, 
  MessageSquare, 
  Mail, 
  Bell, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  Save, 
  X,
  Smartphone,
  CreditCard,
  FileText,
  Gift,
  AlertCircle,
  History,
  Play,
  Pause,
  ExternalLink,
  QrCode,
  DollarSign,
  Lock
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../auth/Auth';
import { AutomationRule, IntegrationConfig, AutomationLog, OperationType } from '../../types';
import { cn, handleFirestoreError } from '../../utils';
import { toast } from 'sonner';
import { runAutomationChecks } from './services/automationService';

const Automations: React.FC<{ setActiveTab?: (tab: string) => void }> = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveSubTab] = useState<'rules' | 'integrations' | 'logs'>('rules');
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddRuleModalOpen, setIsAddRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isRunningChecks, setIsRunningChecks] = useState(false);

  const [ruleFormData, setRuleFormData] = useState<Partial<AutomationRule>>({
    name: '',
    type: 'revision',
    triggerDays: 180,
    messageTemplate: 'Olá {cliente}, notamos que seu veículo {veiculo} está próximo da revisão. Agende agora pelo nosso WhatsApp!',
    channel: 'whatsapp',
    active: true
  });

  useEffect(() => {
    if (!profile?.empresaId) return;

    const rulesQuery = query(
      collection(db, 'automacao_regras'),
      where('empresaId', '==', profile.empresaId),
      orderBy('createdAt', 'desc')
    );

    const integrationsQuery = query(
      collection(db, 'integracoes'),
      where('empresaId', '==', profile.empresaId)
    );

    const logsQuery = query(
      collection(db, 'automacao_logs'),
      where('empresaId', '==', profile.empresaId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribeRules = onSnapshot(rulesQuery, (snapshot) => {
      const list: AutomationRule[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as AutomationRule));
      setRules(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'automacao_regras');
    });

    const unsubscribeIntegrations = onSnapshot(integrationsQuery, (snapshot) => {
      const list: IntegrationConfig[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as IntegrationConfig));
      setIntegrations(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'integracoes');
    });

    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const list: AutomationLog[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as AutomationLog));
      setLogs(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'automacao_logs');
    });

    const companyRef = doc(db, 'empresas', profile.empresaId);
    const unsubscribeCompany = onSnapshot(companyRef, (doc) => {
      if (doc.exists()) {
        setLastCheck(doc.data().lastAutomationCheck);
      }
    });

    return () => {
      unsubscribeRules();
      unsubscribeIntegrations();
      unsubscribeLogs();
      unsubscribeCompany();
    };
  }, [profile]);

  const handleRunChecks = async () => {
    if (!profile?.empresaId) return;
    setIsRunningChecks(true);
    try {
      const result = await runAutomationChecks(profile.empresaId);
      if (result.success) {
        toast.success(`Verificação concluída! ${result.processed} automações disparadas.`);
      } else {
        toast.error('Erro ao executar verificações.');
      }
    } catch (error) {
      toast.error('Erro ao executar verificações.');
    } finally {
      setIsRunningChecks(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.empresaId) return;

    try {
      const ruleId = editingRule?.id || `rule_${Math.random().toString(36).substr(2, 9)}`;
      const ruleData = {
        ...ruleFormData,
        empresaId: profile.empresaId,
        updatedAt: serverTimestamp(),
        createdAt: editingRule?.createdAt || serverTimestamp()
      };

      await setDoc(doc(db, 'automacao_regras', ruleId), ruleData, { merge: true });
      toast.success(editingRule ? 'Regra atualizada!' : 'Nova regra criada!');
      setIsAddRuleModalOpen(false);
      setEditingRule(null);
      setRuleFormData({
        name: '',
        type: 'revision',
        triggerDays: 180,
        messageTemplate: '',
        channel: 'whatsapp',
        active: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'automacao_regras');
    }
  };

  const toggleRuleStatus = async (rule: AutomationRule) => {
    try {
      await updateDoc(doc(db, 'automacao_regras', rule.id), {
        active: !rule.active,
        updatedAt: serverTimestamp()
      });
      toast.success(`Regra ${!rule.active ? 'ativada' : 'desativada'}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `automacao_regras/${rule.id}`);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;
    try {
      await deleteDoc(doc(db, 'automacao_regras', id));
      toast.success('Regra excluída!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `automacao_regras/${id}`);
    }
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'revision': return <Clock className="text-blue-500" />;
      case 'post-sales': return <CheckCircle2 className="text-green-500" />;
      case 'billing': return <DollarSign className="text-red-500" />;
      case 'birthday': return <Gift className="text-pink-500" />;
      case 'account-expiration': return <AlertCircle className="text-orange-500" />;
      case 'quote-followup': return <MessageSquare className="text-purple-500" />;
      case 'inactive-client': return <History className="text-slate-500" />;
      default: return <Zap className="text-accent" />;
    }
  };

  const getRuleLabel = (type: string) => {
    switch (type) {
      case 'revision': return 'Lembrete de Revisão';
      case 'post-sales': return 'Pós-Venda Automático';
      case 'billing': return 'Cobrança Automática';
      case 'birthday': return 'Aniversariantes';
      case 'account-expiration': return 'Vencimento de Contas';
      case 'quote-followup': return 'Follow-up de Orçamento';
      case 'inactive-client': return 'Recuperação de Inativos';
      default: return type;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 glass-card p-8 rounded-[2.5rem]">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <Zap className="text-accent animate-pulse" size={32} />
            Automações & Integrações
          </h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Otimize sua oficina com processos automáticos</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <button 
            onClick={() => setActiveSubTab('rules')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'rules' ? "bg-white text-accent shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Regras
          </button>
          <button 
            onClick={() => setActiveSubTab('integrations')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'integrations' ? "bg-white text-accent shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Integrações
          </button>
          <button 
            onClick={() => setActiveSubTab('logs')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'logs' ? "bg-white text-accent shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Histórico
          </button>
        </div>
      </div>

      {activeTab === 'rules' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Settings size={18} className="text-accent" />
              Regras Ativas
            </h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
              {lastCheck && (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  Última verificação: {new Date(lastCheck).toLocaleString('pt-BR')}
                </span>
              )}
              <div className="flex gap-4 w-full sm:w-auto">
                <button 
                  onClick={handleRunChecks}
                  disabled={isRunningChecks}
                  className={cn(
                    "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black transition-all text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-50",
                    isRunningChecks && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Play size={18} className={isRunningChecks ? "animate-spin" : ""} />
                  {isRunningChecks ? 'Executando...' : 'Executar Verificações'}
                </button>
                <button 
                  onClick={() => {
                    setEditingRule(null);
                    setRuleFormData({
                      name: '',
                      type: 'revision',
                      triggerDays: 180,
                      messageTemplate: '',
                      channel: 'whatsapp',
                      active: true
                    });
                    setIsAddRuleModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-accent text-accent-foreground px-6 py-3 rounded-2xl font-black hover:opacity-90 transition-all shadow-xl shadow-accent/20 text-xs uppercase tracking-widest"
                >
                  <Plus size={18} />
                  Nova Regra
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform">
                    {getRuleIcon(rule.type)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleRuleStatus(rule)}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        rule.active ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-400"
                      )}
                    >
                      {rule.active ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                    <button 
                      onClick={() => {
                        setEditingRule(rule);
                        setRuleFormData(rule);
                        setIsAddRuleModalOpen(true);
                      }}
                      className="p-2 bg-slate-50 text-slate-400 hover:text-accent rounded-xl transition-all"
                    >
                      <Settings size={16} />
                    </button>
                    <button 
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h4 className="text-lg font-black text-slate-900 mb-1">{rule.name}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{getRuleLabel(rule.type)}</p>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={14} />
                    <span>Gatilho: {rule.triggerDays} dias {rule.triggerDays > 0 ? 'após' : 'antes'} o evento</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Smartphone size={14} />
                    <span>Canal: {rule.channel}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Template da Mensagem</p>
                  <p className="text-xs text-slate-600 line-clamp-2 italic">"{rule.messageTemplate}"</p>
                </div>
              </div>
            ))}

            {rules.length === 0 && !loading && (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                <Zap size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Nenhuma regra configurada</h3>
                <p className="text-xs text-slate-400 mt-2">Comece criando sua primeira automação para economizar tempo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* WhatsApp */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex items-center justify-between mb-8">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shadow-lg shadow-green-100 border border-green-100">
                <MessageSquare size={32} />
              </div>
              <span className="px-4 py-1.5 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-green-100">
                Recomendado
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">WhatsApp Business</h3>
            <p className="text-sm text-slate-500 mb-8">Envie lembretes, orçamentos e notificações automáticas diretamente para o celular do cliente.</p>
            <div className="flex gap-2">
              <button className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                <ExternalLink size={18} />
                Configurar API
              </button>
              <button 
                onClick={() => toast.info('Teste de WhatsApp iniciado...')}
                className="px-4 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Testar
              </button>
            </div>
          </div>

          {/* NFS-e */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-lg shadow-blue-100 border border-blue-100">
                <FileText size={32} />
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">NFS-e Automática</h3>
            <p className="text-sm text-slate-500 mb-8">Emissão automática de Notas Fiscais de Serviço ao finalizar a Ordem de Serviço.</p>
            <button className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest cursor-not-allowed flex items-center justify-center gap-2">
              <Lock size={18} />
              Em breve
            </button>
          </div>

          {/* PIX */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="w-16 h-16 bg-cyan-50 rounded-2xl flex items-center justify-center text-cyan-600 shadow-lg shadow-cyan-100 border border-cyan-100">
                <QrCode size={32} />
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">PIX Integrado</h3>
            <p className="text-sm text-slate-500 mb-8">Gere QR Codes dinâmicos para cada venda e receba confirmação de pagamento instantânea.</p>
            <button className="w-full py-4 bg-accent text-accent-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <Settings size={18} />
              Ativar PIX
            </button>
          </div>

          {/* Stripe / Mercado Pago */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-lg shadow-indigo-100 border border-indigo-100">
                <CreditCard size={32} />
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Cartão & Online</h3>
            <p className="text-sm text-slate-500 mb-8">Integração com Stripe e Mercado Pago para recebimento via cartão de crédito e links de pagamento.</p>
            <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
              <Settings size={18} />
              Conectar Gateways
            </button>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <History size={18} className="text-accent" />
              Histórico de Envios
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Data/Hora</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Regra</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-bold text-slate-600">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-xs font-bold text-slate-900">
                        {rules.find(r => r.id === log.ruleId)?.name || 'Regra Excluída'}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-xs text-slate-500">
                      ID: {log.clienteId}
                    </td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        log.status === 'sent' ? "bg-green-50 text-green-600 border-green-100" :
                        log.status === 'failed' ? "bg-red-50 text-red-600 border-red-100" :
                        "bg-slate-50 text-slate-400 border-slate-100"
                      )}>
                        {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Erro' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {logs.length === 0 && (
              <div className="p-20 text-center">
                <History size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Nenhuma atividade recente</h3>
                <p className="text-xs text-slate-400 mt-2">As automações disparadas aparecerão aqui para seu controle.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Rule Modal */}
      {isAddRuleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900">{editingRule ? 'Editar Regra' : 'Nova Automação'}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configure o comportamento da regra</p>
              </div>
              <button 
                onClick={() => setIsAddRuleModalOpen(false)}
                className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveRule} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Regra</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Lembrete de Revisão 6 Meses"
                    className="input-modern"
                    value={ruleFormData.name}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de Evento</label>
                  <select 
                    className="select-modern"
                    value={ruleFormData.type}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, type: e.target.value as any })}
                  >
                    <option value="revision">Lembrete de Revisão</option>
                    <option value="post-sales">Pós-Venda Automático</option>
                    <option value="billing">Cobrança Automática</option>
                    <option value="birthday">Aniversariantes</option>
                    <option value="account-expiration">Vencimento de Contas</option>
                    <option value="quote-followup">Follow-up de Orçamento</option>
                    <option value="inactive-client">Recuperação de Inativos</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gatilho (Dias)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required
                      className="input-modern"
                      value={ruleFormData.triggerDays}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, triggerDays: parseInt(e.target.value) })}
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dias</span>
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1 italic">Use números negativos para dias antes do evento.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Canal de Envio</label>
                  <select 
                    className="select-modern"
                    value={ruleFormData.channel}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, channel: e.target.value as any })}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Template da Mensagem</label>
                  <div className="flex gap-2">
                    {['{cliente}', '{veiculo}', '{data}', '{valor}'].map(tag => (
                      <button 
                        key={tag}
                        type="button"
                        onClick={() => setRuleFormData({ ...ruleFormData, messageTemplate: (ruleFormData.messageTemplate || '') + tag })}
                        className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md hover:bg-accent hover:text-white transition-all"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea 
                  required
                  rows={4}
                  className="textarea-modern"
                  placeholder="Escreva a mensagem que será enviada..."
                  value={ruleFormData.messageTemplate}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, messageTemplate: e.target.value })}
                />
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsAddRuleModalOpen(false)}
                  className="flex-1 px-8 py-4 border border-slate-200 rounded-2xl font-black text-slate-600 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-8 py-4 bg-accent text-accent-foreground rounded-2xl font-black hover:opacity-90 transition-all shadow-xl shadow-accent/20 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {editingRule ? 'Salvar Alterações' : 'Criar Automação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Automations;
