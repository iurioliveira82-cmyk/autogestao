import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Supplier } from '../types';

export const useSuppliers = (empresaId: string | undefined) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;

    const q = query(collection(db, 'fornecedores'), where('empresaId', '==', empresaId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Supplier[] = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(list);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching suppliers:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [empresaId]);

  return { suppliers, loading };
};
