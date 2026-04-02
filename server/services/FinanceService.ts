import { 
  getDb, 
  getCollection, 
  getDocuments, 
  applyQuery, 
  qWhere, 
  qOrderBy, 
  qLimit, 
  isUsingClientSdk,
  addDocument,
  updateDocument,
  deleteDocument,
  getDocument
} from '../lib/firebase-admin.ts';

export class FinanceService {
  async getTransactions(empresaId: string, filters: any) {
    console.log(`[FinanceService] Fetching transactions for Empresa: ${empresaId} (ClientSDK: ${isUsingClientSdk()})`);
    
    try {
      if (!empresaId) throw new Error('empresaId is required');

      const collectionRef = getCollection('transacoes_financeiras');
      const constraints: any[] = [qWhere('empresaId', '==', empresaId)];

      if (filters.startDate && filters.endDate) {
        constraints.push(qWhere('date', '>=', filters.startDate));
        constraints.push(qWhere('date', '<=', filters.endDate));
      }

      if (filters.tipo && filters.tipo !== 'all') {
        constraints.push(qWhere('tipo', '==', filters.tipo));
      }

      const queryRef = applyQuery(collectionRef, constraints);
      let docs = await getDocuments(queryRef);

      docs.sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });

      return docs;
    } catch (error: any) {
      console.error(`[FinanceService] Error fetching transactions:`, error.message);
      throw error;
    }
  }

  async createTransaction(empresaId: string, data: any) {
    return addDocument('transacoes_financeiras', { ...data, empresaId });
  }

  async updateTransaction(empresaId: string, id: string, data: any) {
    const doc = await getDocument('transacoes_financeiras', id);
    if (!doc || doc.empresaId !== empresaId) {
      throw new Error('Transaction not found or unauthorized');
    }
    return updateDocument('transacoes_financeiras', id, data);
  }

  async deleteTransaction(empresaId: string, id: string) {
    const doc = await getDocument('transacoes_financeiras', id);
    if (!doc || doc.empresaId !== empresaId) {
      throw new Error('Transaction not found or unauthorized');
    }
    return deleteDocument('transacoes_financeiras', id);
  }
}
