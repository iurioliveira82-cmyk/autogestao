import React, { useState } from 'react';
import { AuthProvider, useAuth, LoginScreen } from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
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
import { Toaster } from 'sonner';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

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
      case 'dashboard': return <Dashboard />;
      case 'clients': return <Clients />;
      case 'vehicles': return <Vehicles />;
      case 'os': return <ServiceOrders setActiveTab={setActiveTab} />;
      case 'agenda': return <Agenda setActiveTab={setActiveTab} />;
      case 'services': return <Services />;
      case 'inventory': return <Inventory />;
      case 'suppliers': return <Suppliers />;
      case 'stock': return <Stock />;
      case 'finance': return <Finance />;
      case 'resale': return <Resale />;
      case 'users': return <Users />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" richColors closeButton />
    </AuthProvider>
  );
}
