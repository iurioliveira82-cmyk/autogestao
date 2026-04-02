import { useState, useEffect, useCallback } from 'react';
import { financeService } from '../services/financeService';
import { toast } from 'sonner';

export const useFinance = (filters: any = {}) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeService.getTransactions(filters);
      setTransactions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      toast.error('Erro ao carregar transações: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = async (data: any) => {
    try {
      const newTransaction = await financeService.createTransaction(data);
      setTransactions(prev => [newTransaction, ...prev]);
      toast.success('Transação criada com sucesso');
      return newTransaction;
    } catch (err: any) {
      toast.error('Erro ao criar transação: ' + err.message);
      throw err;
    }
  };

  const updateTransaction = async (id: string, data: any) => {
    try {
      const updated = await financeService.updateTransaction(id, data);
      setTransactions(prev => prev.map(t => t.id === id ? updated : t));
      toast.success('Transação atualizada com sucesso');
      return updated;
    } catch (err: any) {
      toast.error('Erro ao atualizar transação: ' + err.message);
      throw err;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await financeService.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      toast.success('Transação excluída com sucesso');
    } catch (err: any) {
      toast.error('Erro ao excluir transação: ' + err.message);
      throw err;
    }
  };

  return {
    transactions,
    loading,
    error,
    refresh: fetchTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
};
