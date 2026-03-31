import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  subDays,
  subMonths,
  format,
  isWithinInterval,
  parseISO,
  differenceInDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../../../firebase';
import { 
  ServiceOrder, 
  Client, 
  InventoryItem, 
  FinancialTransaction, 
  UserProfile,
  Service
} from '../../../types';

export interface AnalyticsData {
  billing: {
    daily: { date: string; value: number }[];
    monthly: { month: string; value: number }[];
    annual: { year: string; value: number }[];
  };
  technicians: {
    id: string;
    name: string;
    osCount: number;
    revenue: number;
    productivity: number;
  }[];
  topServices: { name: string; count: number; revenue: number }[];
  topParts: { name: string; count: number; revenue: number }[];
  recurringClients: { id: string; name: string; visitCount: number; totalSpent: number }[];
  profitByCategory: { category: string; revenue: number; cost: number; profit: number }[];
  metrics: {
    returnRate: number;
    avgTicket: number;
    ltv: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
  };
  clientABC: { id: string; name: string; revenue: number; percentage: number; category: 'A' | 'B' | 'C' }[];
}

export const useAnalyticsData = (empresaId: string, period: '7d' | '30d' | '90d' | '12m' | 'all' = '30d') => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!empresaId) return;
      setLoading(true);

      try {
        // Calculate date range
        const now = new Date();
        let startDate: Date;
        switch (period) {
          case '7d': startDate = subDays(now, 7); break;
          case '30d': startDate = subDays(now, 30); break;
          case '90d': startDate = subDays(now, 90); break;
          case '12m': startDate = subMonths(now, 12); break;
          case 'all': startDate = new Date(2000, 0, 1); break;
          default: startDate = subDays(now, 30);
        }

        // Fetch all necessary data in parallel
        const [osSnap, transSnap, clientsSnap, usersSnap, servicesSnap] = await Promise.all([
          getDocs(query(collection(db, 'ordens_servico'), where('empresaId', '==', empresaId), where('createdAt', '>=', startDate.toISOString()))),
          getDocs(query(collection(db, 'transacoes_financeiras'), where('empresaId', '==', empresaId), where('date', '>=', startDate.toISOString()))),
          getDocs(query(collection(db, 'clientes'), where('empresaId', '==', empresaId))),
          getDocs(query(collection(db, 'usuarios'), where('empresaId', '==', empresaId))),
          getDocs(query(collection(db, 'catalogo_servicos'), where('empresaId', '==', empresaId)))
        ]);

        const osList = osSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
        const transList = transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialTransaction));
        const clientsList = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        const usersList = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        const servicesList = servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));

        const clientMap = new Map(clientsList.map(c => [c.id, c]));
        const userMap = new Map(usersList.map(u => [u.uid, u]));
        const serviceMap = new Map(servicesList.map(s => [s.id, s]));

        // 1. Billing Calculations
        const dailyMap = new Map<string, number>();
        const monthlyMap = new Map<string, number>();
        const annualMap = new Map<string, number>();

        transList.forEach(t => {
          if (t.type === 'in' && t.status === 'paid') {
            const date = parseISO(t.date);
            const dKey = format(date, 'yyyy-MM-dd');
            const mKey = format(date, 'yyyy-MM');
            const yKey = format(date, 'yyyy');

            dailyMap.set(dKey, (dailyMap.get(dKey) || 0) + t.value);
            monthlyMap.set(mKey, (monthlyMap.get(mKey) || 0) + t.value);
            annualMap.set(yKey, (annualMap.get(yKey) || 0) + t.value);
          }
        });

        // 2. Technician Performance
        const techStats = new Map<string, { osCount: number; revenue: number; daysActive: Set<string> }>();
        osList.forEach(os => {
          if (os.status === 'finalizada' && os.tecnicoResponsavelId) {
            const stats = techStats.get(os.tecnicoResponsavelId) || { osCount: 0, revenue: 0, daysActive: new Set() };
            stats.osCount++;
            stats.revenue += os.valorTotal;
            stats.daysActive.add(os.createdAt.split('T')[0]);
            techStats.set(os.tecnicoResponsavelId, stats);
          }
        });

        const technicians = Array.from(techStats.entries()).map(([id, stats]) => ({
          id,
          name: userMap.get(id)?.name || 'Desconhecido',
          osCount: stats.osCount,
          revenue: stats.revenue,
          productivity: stats.osCount / (stats.daysActive.size || 1)
        })).sort((a, b) => b.revenue - a.revenue);

        // 3. Top Services & Parts
        const serviceCounts = new Map<string, { count: number; revenue: number }>();
        const partCounts = new Map<string, { count: number; revenue: number }>();
        const categoryStats = new Map<string, { revenue: number; cost: number }>();

        osList.forEach(os => {
          if (os.status === 'finalizada') {
            os.servicos?.forEach(s => {
              const name = s.name;
              const stats = serviceCounts.get(name) || { count: 0, revenue: 0 };
              stats.count += s.quantity;
              stats.revenue += s.price * s.quantity;
              serviceCounts.set(name, stats);

              // Category profit
              const serviceInfo = s.serviceId ? serviceMap.get(s.serviceId) : null;
              const category = serviceInfo?.category || 'Geral';
              const catStats = categoryStats.get(category) || { revenue: 0, cost: 0 };
              catStats.revenue += s.price * s.quantity;
              catStats.cost += (s.cost || 0) * s.quantity;
              categoryStats.set(category, catStats);
            });

            os.pecas?.forEach(p => {
              const name = p.name;
              const stats = partCounts.get(name) || { count: 0, revenue: 0 };
              stats.count += p.quantity;
              stats.revenue += p.price * p.quantity;
              partCounts.set(name, stats);

              // Parts usually go to a "Peças" category
              const catStats = categoryStats.get('Peças') || { revenue: 0, cost: 0 };
              catStats.revenue += p.price * p.quantity;
              catStats.cost += (p.cost || 0) * p.quantity;
              categoryStats.set('Peças', catStats);
            });
          }
        });

        const topServices = Array.from(serviceCounts.entries())
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const topParts = Array.from(partCounts.entries())
          .map(([name, stats]) => ({ name, ...stats }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const profitByCategory = Array.from(categoryStats.entries())
          .map(([category, stats]) => ({
            category,
            revenue: stats.revenue,
            cost: stats.cost,
            profit: stats.revenue - stats.cost
          }))
          .sort((a, b) => b.profit - a.profit);

        // 4. Client Metrics & ABC
        const clientStats = new Map<string, { visitCount: number; totalSpent: number; lastVisit: string }>();
        osList.forEach(os => {
          if (os.status === 'finalizada') {
            const stats = clientStats.get(os.clienteId) || { visitCount: 0, totalSpent: 0, lastVisit: '' };
            stats.visitCount++;
            stats.totalSpent += os.valorTotal;
            if (os.createdAt > stats.lastVisit) stats.lastVisit = os.createdAt;
            clientStats.set(os.clienteId, stats);
          }
        });

        const recurringClients = Array.from(clientStats.entries())
          .filter(([_, stats]) => stats.visitCount > 1)
          .map(([id, stats]) => ({
            id,
            name: clientMap.get(id)?.name || 'Desconhecido',
            visitCount: stats.visitCount,
            totalSpent: stats.totalSpent
          }))
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 10);

        // Client ABC Curve
        const sortedClientsForABC = Array.from(clientStats.entries())
          .map(([id, stats]) => ({
            id,
            name: clientMap.get(id)?.name || 'Desconhecido',
            revenue: stats.totalSpent
          }))
          .sort((a, b) => b.revenue - a.revenue);

        const totalClientRevenue = sortedClientsForABC.reduce((sum, c) => sum + c.revenue, 0);
        let cumulativeRevenue = 0;
        const clientABC: AnalyticsData['clientABC'] = sortedClientsForABC.map(c => {
          cumulativeRevenue += c.revenue;
          const percentage = (cumulativeRevenue / totalClientRevenue) * 100;
          let category: 'A' | 'B' | 'C' = 'C';
          if (percentage <= 70) category = 'A';
          else if (percentage <= 90) category = 'B';
          
          return {
            ...c,
            percentage,
            category
          };
        });

        // 5. General Metrics
        const totalRevenue = transList.reduce((sum, t) => t.type === 'in' && t.status === 'paid' ? sum + t.value : sum, 0);
        const totalCost = transList.reduce((sum, t) => t.type === 'out' && t.status === 'paid' ? sum + t.value : sum, 0);
        const finishedOSCount = osList.filter(os => os.status === 'finalizada').length;
        
        // Return Rate: clients with > 1 OS in the period / total clients in the period
        const clientsWithMultipleOS = Array.from(clientStats.values()).filter(s => s.visitCount > 1).length;
        const totalClientsInPeriod = clientStats.size;

        setData({
          billing: {
            daily: Array.from(dailyMap.entries()).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
            monthly: Array.from(monthlyMap.entries()).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month)),
            annual: Array.from(annualMap.entries()).map(([year, value]) => ({ year, value })).sort((a, b) => a.year.localeCompare(b.year))
          },
          technicians,
          topServices,
          topParts,
          recurringClients,
          profitByCategory,
          metrics: {
            returnRate: totalClientsInPeriod > 0 ? (clientsWithMultipleOS / totalClientsInPeriod) * 100 : 0,
            avgTicket: finishedOSCount > 0 ? totalRevenue / finishedOSCount : 0,
            ltv: totalClientsInPeriod > 0 ? totalRevenue / totalClientsInPeriod : 0,
            totalRevenue,
            totalCost,
            totalProfit: totalRevenue - totalCost
          },
          clientABC
        });
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [empresaId, period]);

  return { data, loading };
};
