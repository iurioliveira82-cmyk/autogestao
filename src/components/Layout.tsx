import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  ClipboardList, 
  Calendar, 
  Settings, 
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
  FileText
} from 'lucide-react';
import { useAuth } from './Auth';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string, itemId?: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, logout, isAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isGestaoOpen, setIsGestaoOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'vehicles', label: 'Veículos', icon: Car },
    { id: 'os', label: 'Ordens de Serviço', icon: ClipboardList },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'services', label: 'Serviços', icon: Wrench },
    { 
      id: 'gestao', 
      label: 'Gestão', 
      icon: Settings,
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
  ];

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
        "fixed lg:static inset-y-0 left-0 w-72 bg-white border-r border-zinc-200 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-10 px-2 shrink-0">
            <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-zinc-200">
              <Car size={24} />
            </div>
            <span className="text-xl font-bold text-zinc-900 tracking-tight">AutoGestão</span>
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
                      onClick={() => setIsGestaoOpen(!isGestaoOpen)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                        isAnySubActive ? "text-zinc-900 font-bold" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                      )}
                    >
                      <item.icon size={20} className={cn(
                        "transition-colors",
                        isAnySubActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-900"
                      )} />
                      <span className="font-medium flex-1 text-left">{item.label}</span>
                      <ChevronRight size={16} className={cn("transition-transform", isGestaoOpen && "rotate-90")} />
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
                                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group",
                                activeTab === sub.id 
                                  ? "bg-zinc-900 text-white shadow-md shadow-zinc-200" 
                                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                              )}
                            >
                              <sub.icon size={18} className={cn(
                                "transition-colors",
                                activeTab === sub.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-900"
                              )} />
                              <span className="text-sm font-medium flex-1 text-left">{sub.label}</span>
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
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    activeTab === item.id 
                      ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" 
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  <item.icon size={20} className={cn(
                    "transition-colors",
                    activeTab === item.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-900"
                  )} />
                  <span className="font-medium flex-1 text-left">{item.label}</span>
                  {activeTab === item.id && <ChevronRight size={16} />}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-zinc-100">
            <div className="bg-zinc-50 p-4 rounded-2xl mb-4 border border-zinc-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-zinc-600 border border-zinc-200 shadow-sm">
                  <UserCircle size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{profile?.name}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{profile?.role}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all duration-200 text-xs font-bold"
              >
                <LogOut size={14} />
                Trocar Usuário
              </button>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2 text-zinc-400 hover:text-red-500 transition-all duration-200 text-xs font-medium"
            >
              Sair do Sistema
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <button 
            className="lg:hidden text-zinc-500 p-2 -ml-2 hover:bg-zinc-100 rounded-lg transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          <div className="flex-1 px-4">
            <h2 className="text-lg font-bold text-zinc-900 capitalize">
              {menuItems.find(item => item.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4">
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
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
