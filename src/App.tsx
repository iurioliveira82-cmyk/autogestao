import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, LoginScreen } from './modules/auth/Auth';
import AppLayout from './layouts/AppLayout';
import { AppRoutes } from './routes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import { OSStatus } from './types';

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

    const accentColor = localStorage.getItem('accentColor') || 'slate';
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Carregando AutoGestão...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <AppLayout activeTab={activeTab} setActiveTab={handleSetActiveTab}>
      <AppRoutes 
        activeTab={activeTab} 
        setActiveTab={handleSetActiveTab}
        activeItemId={activeItemId}
        activeItemStatus={activeItemStatus}
        stockSupplierId={stockSupplierId}
      />
    </AppLayout>
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
