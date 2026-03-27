import React, { useState } from 'react';
import { 
  LayoutDashboard, 
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
  UserPlus
} from 'lucide-react';
import { useAuth } from './Auth';
import { cn } from '../lib/utils';
import AIAssistant from './AIAssistant';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string, itemId?: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, logout, isAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

  const [isGestaoOpen, setIsGestaoOpen] = useState(() => {
    const saved = localStorage.getItem('isGestaoOpen');
    if (saved !== null) return saved === 'true';
    return true;
  });

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'leads', label: 'Leads', icon: UserPlus },
    { id: 'vehicles', label: 'Veículos', icon: Car },
    { id: 'os', label: 'Ordens de Serviço', icon: ClipboardList },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'services', label: 'Serviços', icon: Wrench },
    { 
      id: 'gestao', 
      label: 'Gestão', 
      icon: SettingsIcon,
      isParent: true,
      subItems: [
        { id: 'inventory', label: 'Estoque', icon: Package },
        { id: 'suppliers', label: 'Fornecedores', icon: Truck },
        { id: 'stock', label: 'Movimentação', icon: ArrowUpDown },
        { id: 'finance', label: 'Financeiro', icon: DollarSign, adminOnly: true },
        { id: 'fiscal', label: 'Fiscal', icon: FileText, adminOnly: true },
      ]
    },
    { id: 'resale', label: 'Revenda', icon: ShoppingBag },
    { id: 'users', label: 'Usuários', icon: Users, adminOnly: true },
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
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-all"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-10 px-2 shrink-0">
            <div className="w-10 h-10 bg-accent text-accent-foreground rounded-xl flex items-center justify-center shadow-lg shadow-zinc-200 dark:shadow-none overflow-hidden">
              {localStorage.getItem('companyLogo') ? (
                <img 
                  src={localStorage.getItem('companyLogo') || ''} 
                  alt="Logo" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Car size={24} />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">AutoGestão</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Sistema Pro</span>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
              if (!checkPermission(item)) return null;

              if (item.isParent) {
                const isAnySubActive = item.subItems?.some(sub => sub.id === activeTab);
                const hasVisibleSubItems = item.subItems?.some(sub => checkPermission(sub));
                
                if (!hasVisibleSubItems) return null;

                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      onClick={handleToggleGestao}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                        isAnySubActive ? "text-accent font-bold bg-accent/5" : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white"
                      )}
                    >
                      <item.icon size={20} className={cn(
                        "transition-colors",
                        isAnySubActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-900"
                      )} />
                      <span className="font-bold flex-1 text-left text-sm">{item.label}</span>
                      <ChevronRight size={16} className={cn("transition-transform duration-200", isGestaoOpen && "rotate-90")} />
                    </button>
                    
                    {isGestaoOpen && (
                      <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                        {item.subItems?.map(sub => {
                          if (!checkPermission(sub)) return null;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                setActiveTab(sub.id);
                                setIsSidebarOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                                activeTab === sub.id 
                                  ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" 
                                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white"
                              )}
                            >
                              <sub.icon size={18} className={cn(
                                "transition-colors",
                                activeTab === sub.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-900"
                              )} />
                              <span className="text-sm font-bold flex-1 text-left">{sub.label}</span>
                              {activeTab === sub.id && (
                                <div className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                    activeTab === item.id 
                      ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" 
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white"
                  )}
                >
                  <item.icon size={20} className={cn(
                    "transition-colors",
                    activeTab === item.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-900"
                  )} />
                  <span className="font-bold flex-1 text-left text-sm">{item.label}</span>
                  {activeTab === item.id && (
                    <div className="absolute right-4 w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl mb-4 border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <UserCircle size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{profile?.name}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{profile?.role}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-all duration-200 text-xs font-bold"
              >
                <LogOut size={14} />
                Trocar Usuário
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 sticky top-0 z-30">
          <button 
            className="lg:hidden text-zinc-500 p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          <div className="flex-1 px-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              {getActiveLabel()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsAIOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 dark:shadow-none"
            >
              <Sparkles size={14} className="text-amber-400" />
              Assistente IA
            </button>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Status</span>
              <span className="text-xs font-bold text-green-500 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Sistema Online
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
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
