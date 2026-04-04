import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, LoginScreen } from './modules/auth/Auth';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AppRoutes } from './routes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import { OSStatus } from './types';
import { Car, Loader2 } from 'lucide-react';

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
    // Reset any existing theme attributes
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-bg');
    
    // Clear theme-related localStorage items
    localStorage.removeItem('darkMode');
    localStorage.removeItem('accentColor');
    localStorage.removeItem('bgColor');
    localStorage.removeItem('companyLogo');
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 transition-colors duration-500 dark:bg-slate-950">
        <div className="relative">
          <div className="w-24 h-24 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/30 animate-pulse rotate-3">
            <Car size={48} />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-800">
            <Loader2 size={20} className="text-primary animate-spin" />
          </div>
        </div>
        <div className="mt-12 text-center space-y-3">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter font-display">AutoGestão</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Carregando seu ecossistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={handleSetActiveTab}>
      <AppRoutes 
        activeTab={activeTab} 
        setActiveTab={handleSetActiveTab}
        activeItemId={activeItemId}
        activeItemStatus={activeItemStatus}
        stockSupplierId={stockSupplierId}
      />
    </DashboardLayout>
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
