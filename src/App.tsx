import React, { useState } from 'react';
import { AuthProvider, useAuth, LoginScreen } from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Leads from './components/Leads';
import Vehicles from './components/Vehicles';
import ServiceOrders from './components/ServiceOrders';
import Agenda from './components/Agenda';
import Services from './components/Services';
import Inventory from './components/Inventory';
import Finance from './components/Finance';
import Resale from './components/Resale';
import Suppliers from './components/Suppliers';
import Stock from './components/Stock';
import Users from './components/Users';
import Fiscal from './components/Fiscal';
import Settings from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import { OSStatus } from './types';
import { useEffect } from 'react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard';
  });
  const [activeItemId, setActiveItemId] = useState<string | undefined>(() => {
    return localStorage.getItem('activeItemId') || undefined;
  });
  const [activeItemStatus, setActiveItemStatus] = useState<OSStatus | undefined>(() => {
    const status = localStorage.getItem('activeItemStatus');
    return (status as OSStatus) || undefined;
  });
  const [stockSupplierId, setStockSupplierId] = useState<string | undefined>(() => {
    return localStorage.getItem('stockSupplierId') || undefined;
  });

  useEffect(() => {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const accentColor = localStorage.getItem('accentColor') || 'zinc';
    document.documentElement.setAttribute('data-theme', accentColor);

    const bgColor = localStorage.getItem('bgColor') || 'white';
    document.documentElement.setAttribute('data-bg', bgColor);
  }, []);

  const handleSetActiveTab = (tab: string, itemId?: string, supplierId?: string, itemStatus?: OSStatus) => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
    
    if (itemId) {
      setActiveItemId(itemId);
      localStorage.setItem('activeItemId', itemId);
    } else {
      setActiveItemId(undefined);
      localStorage.removeItem('activeItemId');
    }

    if (itemStatus) {
      setActiveItemStatus(itemStatus);
      localStorage.setItem('activeItemStatus', itemStatus);
    } else {
      setActiveItemStatus(undefined);
      localStorage.removeItem('activeItemStatus');
    }

    if (supplierId) {
      setStockSupplierId(supplierId);
      localStorage.setItem('stockSupplierId', supplierId);
    } else {
      setStockSupplierId(undefined);
      localStorage.removeItem('stockSupplierId');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium animate-pulse">Carregando AutoGestão...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={handleSetActiveTab} />;
      case 'clients': return <Clients />;
      case 'leads': return <Leads />;
      case 'vehicles': return <Vehicles />;
      case 'os': return <ServiceOrders setActiveTab={handleSetActiveTab} itemId={activeItemId} initialStatus={activeItemStatus} />;
      case 'agenda': return <Agenda setActiveTab={handleSetActiveTab} />;
      case 'services': return <Services />;
      case 'inventory': return <Inventory setActiveTab={handleSetActiveTab} />;
      case 'suppliers': return <Suppliers setActiveTab={handleSetActiveTab} />;
      case 'stock': return <Stock initialItemId={activeItemId} initialSupplierId={stockSupplierId} />;
      case 'finance': return <Finance />;
      case 'fiscal': return <Fiscal setActiveTab={handleSetActiveTab} />;
      case 'resale': return <Resale />;
      case 'users': return <Users />;
      case 'settings': return <Settings />;
      default: return <Dashboard setActiveTab={handleSetActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={handleSetActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </ErrorBoundary>
  );
}
