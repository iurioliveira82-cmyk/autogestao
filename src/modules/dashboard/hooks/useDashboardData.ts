import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { db } from '../../../firebase';
import { ServiceOrder, Client, Vehicle, Appointment, Lead, InventoryItem, FinancialTransaction, OSStatus, OperationType } from '../../../types';
import { FirestoreService } from '../../../services/firestore';
import { handleFirestoreError } from '../../../utils';
import { ptBR } from 'date-fns/locale';

export const useDashboardData = (empresaId: string, isAdmin: boolean, selectedDate: string) => {
  const [stats, setStats] = useState({
    dailyRevenue: 0,
    dailyExpense: 0,
    activeOS: 0,
    todayAppointments: 0,
    totalClients: 0,
    totalVehicles: 0,
    lowStock: 0,
    resaleVehicles: 0,
    averageTicket: 0,
    salesLast7Days: 0,
    hotLeads: 0,
    proposalsInProgress: 0
  });

  const [todayAppointmentsList, setTodayAppointmentsList] = useState<Appointment[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [services, setServices] = useState<Record<string, string>>({});
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [recentOS, setRecentOS] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);

  // Static data
  useEffect(() => {
    if (!empresaId) return;

    // Clients
    const unsubscribeClients = FirestoreService.subscribeByEmpresa<Client>('clientes', empresaId, (data) => {
      setStats(prev => ({ ...prev, totalClients: data.length }));
      const clientMap: Record<string, string> = {};
      data.forEach(client => {
        clientMap[client.id] = client.name;
      });
      setClients(clientMap);
    });

    // Vehicles
    const unsubscribeVehicles = FirestoreService.subscribeByEmpresa<Vehicle>('veiculos', empresaId, (data) => {
      setStats(prev => ({ ...prev, totalVehicles: data.length }));
      const vehicleMap: Record<string, Vehicle> = {};
      data.forEach(vehicle => {
        vehicleMap[vehicle.id] = vehicle;
      });
      setVehicles(vehicleMap);
    });

    // Services
    const unsubscribeServices = FirestoreService.subscribeByEmpresa<any>('catalogo_servicos', empresaId, (data) => {
      const serviceMap: Record<string, string> = {};
      data.forEach(service => {
        serviceMap[service.id] = service.name;
      });
      setServices(serviceMap);
    });

    // Average Ticket (from finished OS)
    const unsubscribeCompletedOS = FirestoreService.subscribeByEmpresa<ServiceOrder>('ordens_servico', empresaId, (data) => {
      const finishedOS = data.filter(os => os.status === 'finalizada');
      let total = 0;
      finishedOS.forEach(os => {
        total += os.valorTotal || 0;
      });
      const avg = finishedOS.length > 0 ? total / finishedOS.length : 0;
      setStats(prev => ({ ...prev, averageTicket: avg }));
    }, [where('status', '==', 'finalizada')]);

    // Low Stock
    const unsubscribeStock = FirestoreService.subscribeByEmpresa<InventoryItem>('inventario', empresaId, (data) => {
      let low = 0;
      const items: InventoryItem[] = [];
      data.forEach(item => {
        if (item.quantidadeAtual <= item.estoqueMinimo) {
          low++;
          items.push(item);
        }
      });
      setStats(prev => ({ ...prev, lowStock: low }));
      setLowStockItems(items);
    });

    // Leads
    const unsubscribeLeads = FirestoreService.subscribeByEmpresa<Lead>('leads', empresaId, (data) => {
      const hot = data.filter(d => d.temperature === 'hot' && !['convertido', 'perdido'].includes(d.status)).length;
      setStats(prev => ({ ...prev, hotLeads: hot }));
    });

    return () => {
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeServices();
      unsubscribeCompletedOS();
      unsubscribeStock();
      unsubscribeLeads();
    };
  }, [empresaId]);

  // Date-dependent data
  useEffect(() => {
    if (!empresaId) return;

    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    // Daily Transactions
    const unsubscribeTransactions = FirestoreService.subscribeByEmpresa<FinancialTransaction>('transacoes_financeiras', empresaId, (data) => {
      let revenue = 0;
      let expense = 0;
      data.forEach(trans => {
        if (trans.type === 'in') revenue += trans.value;
        else expense += trans.value;
      });
      setStats(prev => ({ ...prev, dailyRevenue: revenue, dailyExpense: expense }));
    }, [where('date', '>=', start.toISOString()), where('date', '<=', end.toISOString())]);

    // Orders for selected date
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const startSelected = startOfDay(dateObj);
    const endSelected = endOfDay(dateObj);

    const unsubscribeOS = FirestoreService.subscribeByEmpresa<ServiceOrder>('ordens_servico', empresaId, (data) => {
      const activeStatuses = ['orcamento', 'aguardando_aprovacao', 'aprovada', 'em_execucao', 'aguardando_peca'];
      setStats(prev => ({ ...prev, activeOS: data.filter(d => activeStatuses.includes(d.status)).length }));
      setRecentOS(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, [where('createdAt', '>=', startSelected.toISOString()), where('createdAt', '<=', endSelected.toISOString())]);

    // Today's Appointments
    const unsubscribeAppointments = FirestoreService.subscribeByEmpresa<Appointment>('agendamentos', empresaId, (data) => {
      setStats(prev => ({ ...prev, todayAppointments: data.length }));
      setTodayAppointmentsList(data.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }, [where('startTime', '>=', start.toISOString()), where('startTime', '<=', end.toISOString())]);

    // Chart Data (Last 7 days) - Real-time
    let unsubscribeChart = () => {};
    if (isAdmin) {
      const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
      const qChart = query(
        collection(db, 'transacoes_financeiras'),
        where('empresaId', '==', empresaId),
        where('date', '>=', sevenDaysAgo.toISOString()),
        orderBy('date', 'asc')
      );

      unsubscribeChart = onSnapshot(qChart, (snapshot) => {
        const days: Record<string, { revenue: number, expense: number, name: string }> = {};
        let totalSales = 0;
        
        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
          const d = subDays(new Date(), i);
          const key = format(d, 'yyyy-MM-dd');
          days[key] = {
            revenue: 0,
            expense: 0,
            name: format(d, 'EEE', { locale: ptBR })
          };
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          const dateKey = data.date.split('T')[0];
          if (days[dateKey]) {
            if (data.type === 'in') {
              days[dateKey].revenue += data.value;
              totalSales += data.value;
            }
            else days[dateKey].expense += data.value;
          }
        });

        const chartData = Object.values(days).map(d => ({
          ...d,
          profit: d.revenue - d.expense
        }));
        
        setRevenueData(chartData);
        setStats(prev => ({ ...prev, salesLast7Days: totalSales }));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions_chart');
      });
    }

    return () => {
      unsubscribeTransactions();
      unsubscribeOS();
      unsubscribeAppointments();
      unsubscribeChart();
    };
  }, [empresaId, isAdmin, selectedDate]);

  return {
    stats,
    todayAppointmentsList,
    vehicles,
    services,
    revenueData,
    recentOS,
    clients,
    lowStockItems
  };
};
