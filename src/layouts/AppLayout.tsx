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
  Zap,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../modules/auth/Auth';
import { cn } from '../utils';
import AIAssistant from '../modules/dashboard/AIAssistant';
import { GlobalSearch } from '../components/GlobalSearch';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string, itemId?: string) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, logout, isAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
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

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('openSubmenus');
    if (saved) return JSON.parse(saved);
    return { gestao: true };
  });

  const toggleSubmenu = (id: string) => {
    const newState = { ...openSubmenus, [id]: !openSubmenus[id] };
    setOpenSubmenus(newState);
    localStorage.setItem('openSubmenus', JSON.stringify(newState));
  };

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

  const checkPermission = (item: any) => {
    if (isAdmin) return true;
    if (profile?.permissions) {
      const modulePerm = profile.permissions[item.id as keyof typeof profile.permissions];
      return modulePerm?.view;
    }
    return !item.adminOnly;
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

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-all"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-50 transform transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] lg:translate-x-0 shadow-modern flex flex-col h-screen",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isSidebarCollapsed ? "w-24" : "w-80"
      )}>
        {/* Sidebar Header */}
        <div className="p-8 shrink-0 relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className={cn(
            "flex items-center gap-4 px-2 shrink-0 group relative z-10 transition-all duration-500",
            isSidebarCollapsed && "justify-center px-0"
          )}>
            <div className="w-14 h-14 bg-accent text-accent-foreground rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-accent/30 overflow-hidden rotate-3 group-hover:rotate-0 transition-all duration-700 ease-out shrink-0">
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
            {!isSidebarCollapsed && (
              <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-500">
                <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter leading-none font-display group-hover:text-accent transition-colors duration-500">AutoGestão</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Sistema Pro</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto px-6 space-y-2 custom-scrollbar relative z-10 pb-8">
          {menuItems.map((item) => {
            if (!checkPermission(item)) return null;

            if (item.isParent) {
              const isAnySubActive = item.subItems?.some(sub => sub.id === activeTab);
              const isOpen = openSubmenus[item.id];
              const hasVisibleSubItems = item.subItems?.some(sub => checkPermission(sub));
              
              if (!hasVisibleSubItems) return null;

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => !isSidebarCollapsed && toggleSubmenu(item.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                      isAnySubActive ? "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white",
                      isSidebarCollapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon size={22} className={cn(
                      "transition-all duration-500 shrink-0",
                      isAnySubActive ? "text-accent scale-110" : "text-slate-400 group-hover:text-accent group-hover:scale-110"
                    )} />
                    {!isSidebarCollapsed && (
                      <>
                        <span className="font-bold flex-1 text-left text-sm tracking-tight animate-in fade-in duration-500">{item.label}</span>
                        <ChevronDown size={16} className={cn("transition-transform duration-500 ease-out text-slate-300", isOpen && "rotate-180")} />
                      </>
                    )}
                  </button>
                  
                  {isOpen && !isSidebarCollapsed && (
                    <div className="pl-6 space-y-1 animate-in slide-in-from-top-2 duration-500">
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
                              "w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                              isActive 
                                ? "bg-accent text-accent-foreground shadow-2xl shadow-accent/30 translate-x-1" 
                                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white hover:translate-x-1"
                            )}
                          >
                            <sub.icon size={18} className={cn(
                              "transition-all duration-500 shrink-0",
                              isActive ? "text-accent-foreground scale-110" : "text-slate-400 group-hover:text-accent group-hover:scale-110"
                            )} />
                            <span className="text-sm font-bold flex-1 text-left tracking-tight">{sub.label}</span>
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
                  "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden",
                  isActive 
                    ? "bg-accent text-accent-foreground shadow-2xl shadow-accent/30 translate-x-1" 
                    : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white hover:translate-x-1",
                  isSidebarCollapsed && "justify-center px-0"
                )}
              >
                <item.icon size={22} className={cn(
                  "transition-all duration-500 shrink-0",
                  isActive ? "text-accent-foreground scale-110" : "text-slate-400 group-hover:text-accent group-hover:scale-110"
                )} />
                {!isSidebarCollapsed && (
                  <span className="font-bold flex-1 text-left text-sm tracking-tight animate-in fade-in duration-500">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-6 shrink-0 border-t border-slate-100 dark:border-slate-800 relative z-10">
          <div className={cn(
            "bg-slate-50 dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group/profile transition-all duration-500",
            isSidebarCollapsed ? "p-2 rounded-2xl" : "hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-100 dark:hover:shadow-black/20"
          )}>
            <div className={cn(
              "flex items-center gap-4 mb-4",
              isSidebarCollapsed && "mb-0 justify-center"
            )}>
              <div className="w-12 h-12 bg-white dark:bg-slate-950 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-800 shadow-sm group-hover/profile:scale-110 group-hover/profile:rotate-3 transition-all duration-500 shrink-0">
                <UserCircle size={28} />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 animate-in fade-in duration-500">
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">{profile?.name}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{profile?.role}</p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95"
              >
                <LogOut size={14} />
                Sair
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-app-bg transition-colors duration-500">
        {/* Header */}
        <header className="h-24 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 sm:px-10 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-6">
            <button 
              className="lg:hidden text-slate-500 dark:text-slate-400 p-3 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-2xl transition-all active:scale-90"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>

            <button 
              className="hidden lg:flex text-slate-400 hover:text-accent p-3 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-2xl transition-all active:scale-90"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
              <Menu size={20} />
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
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <button
                onClick={toggleDarkMode}
                className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  !isDarkMode ? "bg-white dark:bg-slate-800 shadow-sm text-amber-500" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Sun size={18} />
              </button>
              <button
                onClick={toggleDarkMode}
                className={cn(
                  "p-2 rounded-xl transition-all duration-300",
                  isDarkMode ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Moon size={18} />
              </button>
            </div>

            <button className="relative p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-950" />
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
        {children}
      </main>

      <AIAssistant 
        isOpen={isAIOpen} 
        onClose={() => setIsAIOpen(false)} 
        context={getActiveLabel()} 
      />
    </div>
  );
};

export default AppLayout;
