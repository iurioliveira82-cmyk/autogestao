import React, { lazy, Suspense } from 'react';
import { OSStatus } from '../types';

// Skeleton Loaders
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

const PageSkeleton = () => (
  <div className="p-8 space-y-6">
    <div className="flex justify-between items-center">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
    <Skeleton className="h-96 w-full" />
  </div>
);

// Lazy loaded modules
const Dashboard = lazy(() => import('../modules/dashboard/Dashboard'));
const Analytics = lazy(() => import('../modules/analytics/Analytics'));
const Clients = lazy(() => import('../modules/clients/Clients'));
const Leads = lazy(() => import('../modules/leads/Leads'));
const Vehicles = lazy(() => import('../modules/vehicles/Vehicles'));
const ServiceOrders = lazy(() => import('../modules/service-orders/ServiceOrders'));
const Agenda = lazy(() => import('../modules/agenda/Agenda'));
const Services = lazy(() => import('../modules/inventory/Services'));
const Inventory = lazy(() => import('../modules/inventory/Inventory'));
const Suppliers = lazy(() => import('../modules/suppliers/Suppliers'));
const Stock = lazy(() => import('../modules/inventory/Stock'));
const Finance = lazy(() => import('../modules/finance/Finance'));
const Fiscal = lazy(() => import('../modules/fiscal/Fiscal'));
const Resale = lazy(() => import('../modules/resale/Resale'));
const Automations = lazy(() => import('../modules/automations/Automations'));
const Users = lazy(() => import('../modules/settings/Users'));
const Settings = lazy(() => import('../modules/settings/Settings'));

interface RouteProps {
  activeTab: string;
  setActiveTab: (tab: string, itemId?: string, supplierId?: string, itemStatus?: OSStatus) => void;
  activeItemId?: string;
  activeItemStatus?: OSStatus;
  stockSupplierId?: string;
}

export const AppRoutes: React.FC<RouteProps> = ({ 
  activeTab, 
  setActiveTab, 
  activeItemId, 
  activeItemStatus, 
  stockSupplierId 
}) => {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {(() => {
        switch (activeTab) {
          case 'dashboard': return <Dashboard setActiveTab={setActiveTab} />;
          case 'analytics': return <Analytics setActiveTab={setActiveTab} />;
          case 'clients': return <Clients setActiveTab={setActiveTab} />;
          case 'leads': return <Leads setActiveTab={setActiveTab} />;
          case 'vehicles': return <Vehicles setActiveTab={setActiveTab} />;
          case 'os': return <ServiceOrders setActiveTab={setActiveTab} itemId={activeItemId} initialStatus={activeItemStatus} />;
          case 'agenda': return <Agenda setActiveTab={setActiveTab} />;
          case 'services': return <Services setActiveTab={setActiveTab} />;
          case 'inventory': return <Inventory setActiveTab={setActiveTab} />;
          case 'suppliers': return <Suppliers setActiveTab={setActiveTab} />;
          case 'stock': return <Stock setActiveTab={setActiveTab} initialItemId={activeItemId} initialSupplierId={stockSupplierId} />;
          case 'finance': return <Finance setActiveTab={setActiveTab} />;
          case 'fiscal': return <Fiscal setActiveTab={setActiveTab} />;
          case 'resale': return <Resale setActiveTab={setActiveTab} />;
          case 'automations': return <Automations setActiveTab={setActiveTab} />;
          case 'users': return <Users setActiveTab={setActiveTab} />;
          case 'settings': return <Settings setActiveTab={setActiveTab} />;
          default: return <Dashboard setActiveTab={setActiveTab} />;
        }
      })()}
    </Suspense>
  );
};
