import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Client } from '../types';

export const useClients = (empresaId: string | undefined) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;

    const q = query(collection(db, 'clientes'), where('empresaId', '==', empresaId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Client[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Client));
      setClients(list);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching clients:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [empresaId]);

  return { clients, loading };
};
