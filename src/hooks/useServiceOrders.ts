import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ServiceOrder } from '../types';

export const useServiceOrders = (empresaId: string | undefined) => {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;

    const q = query(collection(db, 'ordens_servico'), where('empresaId', '==', empresaId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ServiceOrder[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as ServiceOrder));
      setServiceOrders(list);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching service orders:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [empresaId]);

  return { serviceOrders, loading };
};
