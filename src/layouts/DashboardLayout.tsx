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
  Zap,
  ChevronDown,
  Moon,
  Sun,
  Bell
} from 'lucide-react';
import { useAuth } from '../modules/auth/Auth';
import { cn } from '../utils';
import AIAssistant from '../modules/dashboard/AIAssistant';
import { GlobalSearch } from '../components/GlobalSearch';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string, itemId?: string) => void;
}

export function DashboardLayout({ children, activeTab, setActiveTab }: DashboardLayoutProps) {
  const { profile, logout, isAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-500">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-all"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 transform transition-all duration-500 ease-in-out lg:translate-x-0 flex flex-col h-screen shadow-xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}>
        {/* Sidebar Header */}
        <div className="p-6 shrink-0 flex items-center justify-between">
          <div className={cn(
            "flex items-center gap-3 transition-all duration-500",
            isSidebarCollapsed && "justify-center w-full"
          )}>
            <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Car size={24} />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <span className="text-lg font-black text-slate-900 dark:text-white tracking-tighter leading-none">AutoGestão</span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Sistema ERP</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar pb-8">
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
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                      isAnySubActive ? "bg-slate-50 dark:bg-slate-800 text-primary" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                      isSidebarCollapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon size={20} className={cn(
                      "shrink-0",
                      isAnySubActive ? "text-primary" : "text-slate-400 group-hover:text-primary"
                    )} />
                    {!isSidebarCollapsed && (
                      <>
                        <span className="font-semibold flex-1 text-left text-sm tracking-tight">{item.label}</span>
                        <ChevronDown size={14} className={cn("transition-transform duration-300 text-slate-300", isOpen && "rotate-180")} />
                      </>
                    )}
                  </button>
                  
                  {isOpen && !isSidebarCollapsed && (
                    <div className="pl-4 space-y-1">
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
                              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group",
                              isActive 
                                ? "bg-primary text-white shadow-md shadow-primary/20" 
                                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
                            )}
                          >
                            <sub.icon size={16} className={cn(
                              "shrink-0",
                              isActive ? "text-white" : "text-slate-400 group-hover:text-primary"
                            )} />
                            <span className="text-sm font-semibold flex-1 text-left tracking-tight">{sub.label}</span>
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
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white",
                  isSidebarCollapsed && "justify-center px-0"
                )}
              >
                <item.icon size={20} className={cn(
                  "shrink-0",
                  isActive ? "text-white" : "text-slate-400 group-hover:text-primary"
                )} />
                {!isSidebarCollapsed && (
                  <span className="font-semibold flex-1 text-left text-sm tracking-tight">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 shrink-0 border-t border-slate-100 dark:border-slate-800">
          <div className={cn(
            "flex items-center gap-3 p-2 rounded-xl transition-all duration-200",
            isSidebarCollapsed ? "justify-center" : "bg-slate-50 dark:bg-slate-800"
          )}>
            <div className="w-10 h-10 bg-white dark:bg-slate-950 rounded-lg flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm">
              <UserCircle size={24} />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{profile?.name}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{profile?.role}</p>
              </div>
            )}
            {!isSidebarCollapsed && (
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-danger transition-colors"
                title="Sair"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-30 shadow-sm transition-colors duration-500">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-slate-500 p-2 hover:bg-slate-50 rounded-xl transition-all"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>

            <button 
              className="hidden lg:flex text-slate-400 hover:text-primary p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
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

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border-2 border-white dark:border-slate-900" />
            </button>

            <button
              onClick={() => setIsAIOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all text-xs font-black uppercase tracking-widest"
            >
              <Sparkles size={16} className="text-amber-500" />
              Assistente IA
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
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
}
