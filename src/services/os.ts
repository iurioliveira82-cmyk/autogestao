import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  runTransaction,
  increment,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { ServiceOrder, OSStatus, StockMovement, FinancialTransaction } from '../types';

export class OSService {
  private empresaId: string;

  constructor(empresaId: string) {
    this.empresaId = empresaId;
  }

  static async createOS(empresaId: string, data: Partial<ServiceOrder>) {
    try {
      // Get last OS number for this company
      const q = query(
        collection(db, 'ordens_servico'),
        where('empresaId', '==', empresaId),
        orderBy('numeroOS', 'desc'),
        limit(1)
      );
      const lastOSSnap = await getDocs(q);
      const lastNumber = lastOSSnap.empty ? 0 : lastOSSnap.docs[0].data().numeroOS;

      const osRef = await addDoc(collection(db, 'ordens_servico'), {
        ...data,
        numeroOS: lastNumber + 1,
        empresaId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        historico: [{
          status: data.status || 'orcamento',
          usuarioId: auth.currentUser?.uid || '',
          timestamp: new Date().toISOString(),
          notes: 'OS Criada'
        }]
      });

      // If services or parts are provided in the initial data, add them to subcollections
      if (data.servicos) {
        for (const service of data.servicos) {
          await addDoc(collection(db, 'ordens_servico', osRef.id, 'servicos'), service);
        }
      }
      if (data.pecas) {
        for (const part of data.pecas) {
          await addDoc(collection(db, 'ordens_servico', osRef.id, 'pecas'), part);
        }
      }

      return osRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'ordens_servico');
      return null;
    }
  }

  async updateStatus(osId: string, status: OSStatus, notes?: string, userId: string = auth.currentUser?.uid || '') {
    return OSService.updateStatus(osId, this.empresaId, status, userId, notes);
  }

  static async updateStatus(osId: string, empresaId: string, status: OSStatus, userId: string, notes?: string) {
    try {
      const osRef = doc(db, 'ordens_servico', osId);
      const osSnap = await getDoc(osRef);
      if (!osSnap.exists()) return false;
      const osData = osSnap.data() as ServiceOrder;

      // Fetch parts from subcollection
      const partsRef = collection(db, 'ordens_servico', osId, 'pecas');
      const partsSnap = await getDocs(partsRef);
      const parts = partsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      await runTransaction(db, async (transaction) => {
        // Update OS status and history
        const newHistoryItem = {
          status,
          usuarioId: userId,
          timestamp: new Date().toISOString(),
          notes: notes || `Status alterado para ${status}`
        };

        transaction.update(osRef, { 
          status, 
          updatedAt: serverTimestamp(),
          historico: [...(osData.historico || []), newHistoryItem]
        });

        // Add to history subcollection as well for scalability
        const historySubRef = doc(collection(db, 'ordens_servico', osId, 'historico'));
        transaction.set(historySubRef, newHistoryItem);

        // If finished, handle stock and finance
        if (status === 'finalizada') {
          for (const part of parts as any[]) {
            if (part.itemId) {
              const itemRef = doc(db, 'inventario', part.itemId);
              
              // Decrease stock
              transaction.update(itemRef, {
                quantidadeAtual: increment(-part.quantity)
              });

              // Register movement
              const movementRef = doc(collection(db, 'movimentacoes_estoque'));
              transaction.set(movementRef, {
                empresaId,
                itemInventarioId: part.itemId,
                tipo: 'saida',
                origem: `OS #${osData.numeroOS}`,
                ordemServicoId: osId,
                quantidade: part.quantity,
                usuarioId: userId,
                timestamp: new Date().toISOString()
              });
            }
          }

          // Generate account receivable
          const receivableRef = doc(collection(db, 'transacoes_financeiras'));
          transaction.set(receivableRef, {
            empresaId,
            clienteId: osData.clienteId,
            relatedId: osId,
            type: 'in',
            value: osData.valorTotal - (osData.desconto || 0),
            date: new Date().toISOString(),
            description: `OS #${osData.numeroOS} - Finalizada`,
            status: 'pending',
            createdAt: serverTimestamp()
          });
        }
      });

      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ordens_servico/${osId}`);
      return false;
    }
  }
}
