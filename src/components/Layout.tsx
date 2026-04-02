import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BarChart3,
  Users, 
  Car, 
  ClipboardList, 
  Calendar, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight, 
  DollarSign, 
  Package, 
  ShoppingBag,
  Wrench,
  Truck,
  ArrowUpDown,
  UserCircle,
  FileText,
  Sparkles,
  UserPlus,
  Search,
  Moon,
  Sun,
  Bell,
  Zap
} from 'lucide-react';
import { useAuth } from '../modules/auth/Auth';
import { cn } from '../utils';
import AIAssistant from '../modules/dashboard/AIAssistant';
import { GlobalSearch } from './GlobalSearch';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string, itemId?: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, logout, isAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      const isDark = saved === 'true';
      if (isDark) document.documentElement.classList.add('dark');
      return isDark;
    }
    return false;
  });

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const [isGestaoOpen, setIsGestaoOpen] = useState(() => {
    const saved = localStorage.getItem('isGestaoOpen');
    if (saved !== null) return saved === 'true';
    return true;
  });

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Relatórios & BI', icon: BarChart3 },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'leads', label: 'CRM / Leads', icon: UserPlus },
    { id: 'vehicles', label: 'Veículos', icon: Car },
    { id: 'os', label: 'Ordens de Serviço', icon: ClipboardList },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'services', label: 'Catálogo de Serviços', icon: Wrench },
    { 
      id: 'gestao', 
      label: 'Gestão & ERP', 
      icon: SettingsIcon,
      isParent: true,
      subItems: [
        { id: 'inventory', label: 'Inventário / Estoque', icon: Package },
        { id: 'suppliers', label: 'Fornecedores', icon: Truck },
        { id: 'stock', label: 'Movimentações', icon: ArrowUpDown },
        { id: 'finance', label: 'Financeiro (Contas)', icon: DollarSign },
        { id: 'fiscal', label: 'Fiscal / NF-e', icon: FileText },
      ]
    },
    { id: 'resale', label: 'Revenda de Veículos', icon: ShoppingBag },
    { id: 'automations', label: 'Automações & APIs', icon: Zap },
    { id: 'users', label: 'Equipe / Usuários', icon: Users },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon },
  ];

  const handleToggleGestao = () => {
    const newState = !isGestaoOpen;
    setIsGestaoOpen(newState);
    localStorage.setItem('isGestaoOpen', String(newState));
  };

  const getActiveLabel = () => {
    for (const item of menuItems) {
      if (item.id === activeTab) return item.label;
      if (item.subItems) {
        const sub = item.subItems.find(s => s.id === activeTab);
        if (sub) return sub.label;
      }
    }
    return 'Dashboard';
  };

  const checkPermission = (item: any) => {
    if (isAdmin) return true;
    if (profile?.permissions) {
      const modulePerm = profile.permissions[item.id as keyof typeof profile.permissions];
      return modulePerm?.view;
    }
    return !item.adminOnly;
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-all"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-80 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-50 transform transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] lg:translate-x-0 shadow-modern",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar relative">
          {/* Decorative background element */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-4 mb-12 px-2 shrink-0 group relative z-10">
            <div className="w-14 h-14 bg-accent text-accent-foreground rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-accent/30 overflow-hidden rotate-3 group-hover:rotate-0 transition-all duration-700 ease-out">
              {localStorage.getItem('companyLogo') ? (
                <img 
                  src={localStorage.getItem('companyLogo') || ''} 
                  alt="Logo" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Car size={32} className="group-hover:scale-110 transition-transform duration-700" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none font-display group-hover:text-accent transition-colors duration-500">AutoGestão</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Sistema Pro</span>
            </div>
          </div>

          <nav className="flex-1 space-y-3 relative z-10">
            {menuItems.map((item) => {
              if (!checkPermission(item)) return null;

              if (item.isParent) {
                const isAnySubActive = item.subItems?.some(sub => sub.id === activeTab);
                const hasVisibleSubItems = item.subItems?.some(sub => checkPermission(sub));
                
                if (!hasVisibleSubItems) return null;

                return (
                  <div key={item.id} className="space-y-2">
                    <button
                      onClick={handleToggleGestao}
                      className={cn(
                        "w-full flex items-center gap-4 px-6 py-4.5 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                        isAnySubActive ? "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <item.icon size={22} className={cn(
                        "transition-all duration-500",
                        isAnySubActive ? "text-accent scale-110" : "text-slate-400 group-hover:text-accent group-hover:scale-110"
                      )} />
                      <span className="font-bold flex-1 text-left text-sm tracking-tight">{item.label}</span>
                      <ChevronRight size={18} className={cn("transition-transform duration-500 ease-out", isGestaoOpen && "rotate-90")} />
                    </button>
                    
                    {isGestaoOpen && (
                      <div className="pl-6 space-y-2 animate-in">
                        {item.subItems?.map(sub => {
                          if (!checkPermission(sub)) return null;
                          const isActive = activeTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                setActiveTab(sub.id);
                                setIsSidebarOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                                isActive 
                                  ? "bg-accent text-accent-foreground shadow-2xl shadow-accent/30 translate-x-1" 
                                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:translate-x-1"
                              )}
                            >
                              {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
                              )}
                              <sub.icon size={20} className={cn(
                                "transition-all duration-500",
                                isActive ? "text-accent-foreground scale-110" : "text-slate-400 group-hover:text-accent group-hover:scale-110"
                              )} />
                              <span className="text-sm font-bold flex-1 text-left tracking-tight">{sub.label}</span>
                              {isActive && (
                                <div className="absolute right-4 w-1.5 h-1.5 bg-accent-foreground rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4.5 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                    isActive 
                      ? "bg-accent text-accent-foreground shadow-2xl shadow-accent/30 translate-x-1" 
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:translate-x-1"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
                  )}
                  <item.icon size={22} className={cn(
                    "transition-all duration-500",
                    isActive ? "text-accent-foreground scale-110" : "text-slate-400 group-hover:text-accent group-hover:scale-110"
                  )} />
                  <span className="font-bold flex-1 text-left text-sm tracking-tight">{item.label}</span>
                  {isActive && (
                    <div className="absolute right-5 w-1.5 h-1.5 bg-accent-foreground rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-8 border-t border-slate-100 dark:border-slate-800 relative z-10">
            <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[2.5rem] mb-4 border border-slate-100 dark:border-slate-800 shadow-sm group/profile hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-100 dark:hover:shadow-black/20 transition-all duration-500">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-800 shadow-sm group-hover/profile:scale-110 group-hover/profile:rotate-3 transition-all duration-500">
                  <UserCircle size={32} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">{profile?.name}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{profile?.role}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95"
              >
                <LogOut size={14} />
                Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-app-bg transition-colors duration-500">
        {/* Header */}
        <header className="h-24 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 sm:px-10 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-slate-500 dark:text-slate-400 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-90"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            
            <GlobalSearch 
              onSelect={(type, id) => {
                if (type === 'client') setActiveTab('clients', id);
                else if (type === 'os') setActiveTab('os', id);
                else if (type === 'vehicle') setActiveTab('vehicles', id);
              }} 
            />
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <button
                onClick={toggleDarkMode}
                className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  !isDarkMode ? "bg-white dark:bg-slate-700 shadow-sm text-amber-500" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Sun size={18} />
              </button>
              <button
                onClick={toggleDarkMode}
                className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  isDarkMode ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Moon size={18} />
              </button>
            </div>

            <button className="relative p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
            </button>

            <button
              onClick={() => setIsAIOpen(true)}
              className="btn-modern !px-4 sm:!px-6 !py-2.5 flex items-center gap-3 group/ai"
            >
              <Sparkles size={18} className="text-amber-400 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline text-sm font-black uppercase tracking-widest">Assistente IA</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 lg:p-12 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      <AIAssistant 
        isOpen={isAIOpen} 
        onClose={() => setIsAIOpen(false)} 
        context={getActiveLabel()} 
      />
    </div>
  );
};

export default Layout;
