import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Palette, 
  Image as ImageIcon, 
  Trash2, 
  AlertTriangle,
  Save,
  CheckCircle2,
  RefreshCcw,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from './Auth';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc, setDoc, onSnapshot, query, where } from 'firebase/firestore';
import { ConfirmationModal } from './ConfirmationModal';

const Settings: React.FC<{ setActiveTab?: (tab: string, itemId?: string) => void }> = ({ setActiveTab }) => {
  const { isAdmin, profile } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('accentColor') || 'zinc';
  });
  const [bgColor, setBgColor] = useState(() => {
    return localStorage.getItem('bgColor') || 'zinc';
  });
  const [companyLogo, setCompanyLogo] = useState(() => {
    return localStorage.getItem('companyLogo') || '';
  });
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const colors = [
    { id: 'zinc', label: 'Padrão', color: 'bg-zinc-900' },
    { id: 'blue', label: 'Azul', color: 'bg-blue-600' },
    { id: 'indigo', label: 'Índigo', color: 'bg-indigo-600' },
    { id: 'purple', label: 'Roxo', color: 'bg-purple-600' },
    { id: 'green', label: 'Verde', color: 'bg-green-600' },
    { id: 'red', label: 'Vermelho', color: 'bg-red-600' },
    { id: 'orange', label: 'Laranja', color: 'bg-orange-600' },
  ];

  const bgColors = [
    { id: 'white', label: 'Branco', color: 'bg-white' },
    { id: 'zinc', label: 'Zinc', color: 'bg-zinc-50' },
    { id: 'slate', label: 'Slate', color: 'bg-slate-50' },
    { id: 'stone', label: 'Stone', color: 'bg-stone-50' },
    { id: 'neutral', label: 'Neutral', color: 'bg-neutral-50' },
    { id: 'blue', label: 'Blue', color: 'bg-blue-50' },
  ];

  const handleSaveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('darkMode', String(isDarkMode));
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('bgColor', bgColor);
    localStorage.setItem('companyLogo', companyLogo);
    
    // Update document attributes immediately
    document.documentElement.setAttribute('data-theme', accentColor);
    document.documentElement.setAttribute('data-bg', bgColor);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Configurações salvas com sucesso!');
    }, 1000);
  };

  const handleResetDatabase = async () => {
    if (!isAdmin) return;

    try {
      const collections = [
        'clients',
        'vehicles',
        'serviceOrders',
        'appointments',
        'inventory',
        'transactions',
        'stockMovements',
        'suppliers',
        'resaleVehicles',
        'fiscalRecords'
      ];

      toast.loading('Limpando banco de dados...', { id: 'reset' });

      for (const collName of collections) {
        const q = query(collection(db, collName), where('empresaId', '==', profile.empresaId));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, collName, d.id)));
        await Promise.all(deletePromises);
      }

      toast.success('Banco de dados zerado com sucesso!', { id: 'reset' });
      setIsResetModalOpen(false);
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao zerar banco de dados.', { id: 'reset' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Configurações</h2>
          <p className="text-zinc-500 font-medium">Personalize sua experiência no AutoGestão</p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-zinc-200 disabled:opacity-50"
        >
          {isSaving ? <RefreshCcw className="animate-spin" size={20} /> : <Save size={20} />}
          Salvar Alterações
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Personalização */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-zinc-100 rounded-xl">
                <Palette size={20} className="text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Personalização</h3>
            </div>

            {/* Modo Noturno */}
            <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-3">
                {isDarkMode ? <Moon size={20} className="text-zinc-600" /> : <Sun size={20} className="text-zinc-600" />}
                <div>
                  <p className="text-sm font-bold text-zinc-900">Modo Noturno</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Alternar tema</p>
                </div>
              </div>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  isDarkMode ? "bg-accent" : "bg-zinc-200"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  isDarkMode ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            {/* Cor de Destaque */}
            <div className="space-y-3">
              <p className="text-sm font-bold text-zinc-900">Cor de Destaque</p>
              <div className="grid grid-cols-4 gap-3">
                {colors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setAccentColor(color.id)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all",
                      accentColor === color.id ? "border-accent bg-zinc-50" : "border-transparent hover:bg-zinc-50"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg shadow-sm", color.color)} />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{color.label}</span>
                    {accentColor === color.id && (
                      <div className="absolute -top-1 -right-1 bg-accent text-accent-foreground rounded-full p-0.5">
                        <CheckCircle2 size={10} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor de Fundo */}
            <div className="space-y-3">
              <p className="text-sm font-bold text-zinc-900">Cor de Fundo</p>
              <div className="grid grid-cols-5 gap-3">
                {bgColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setBgColor(color.id)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all",
                      bgColor === color.id ? "border-accent bg-zinc-50" : "border-transparent hover:bg-zinc-50"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg shadow-sm border border-zinc-200", color.color)} />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{color.label}</span>
                    {bgColor === color.id && (
                      <div className="absolute -top-1 -right-1 bg-accent text-accent-foreground rounded-full p-0.5">
                        <CheckCircle2 size={10} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo da Empresa */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-zinc-900">Logo da Empresa</p>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">URL da Imagem</span>
              </div>
              <div className="relative">
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="text"
                  placeholder="https://exemplo.com/logo.png"
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
                  value={companyLogo}
                  onChange={(e) => setCompanyLogo(e.target.value)}
                />
              </div>
              {companyLogo && (
                <div className="mt-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-center">
                  <img src={companyLogo} alt="Preview Logo" className="max-h-12 object-contain" referrerPolicy="no-referrer" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Opções Avançadas (Admin) */}
        {isAdmin && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-red-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-50 rounded-xl">
                  <ShieldAlert size={20} className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-red-900">Opções Avançadas</h3>
              </div>

              <div className="p-6 bg-red-50 rounded-3xl border border-red-100 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-red-600 shrink-0" size={24} />
                  <div>
                    <p className="text-sm font-bold text-red-900">Zona de Perigo</p>
                    <p className="text-xs text-red-700 leading-relaxed mt-1">
                      As ações abaixo são irreversíveis. Tenha certeza absoluta antes de prosseguir.
                    </p>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button
                    onClick={() => setIsResetModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
                  >
                    <Trash2 size={20} />
                    Zerar Banco de Dados
                  </button>
                  <p className="text-[10px] text-center font-bold text-red-400 uppercase tracking-widest">
                    Isso apagará todos os clientes, veículos, OS e transações.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-200">
                <p className="text-sm font-bold text-zinc-900 mb-4">Informações do Sistema</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-400">Versão</span>
                    <span className="text-zinc-900">2.4.0-PRO</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-400">Ambiente</span>
                    <span className="text-zinc-900">Produção</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-400">Último Backup</span>
                    <span className="text-zinc-900">Hoje, 04:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetDatabase}
        title="Zerar Banco de Dados?"
        message="Esta ação é IRREVERSÍVEL. Todos os dados do sistema serão apagados permanentemente. Você tem certeza absoluta?"
        confirmLabel="Sim, Apagar Tudo"
        cancelLabel="Cancelar"
        variant="danger"
      />
    </div>
  );
};

export default Settings;
