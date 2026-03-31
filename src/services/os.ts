import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
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
import { db, auth } from '../firebase';
import { handleFirestoreError } from '../utils';
import { OperationType, ServiceOrder, OSStatus, StockMovement, FinancialTransaction, InventoryItem } from '../types';

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

      const { servicos, pecas, ...mainData } = data;
      const osRef = await addDoc(collection(db, 'ordens_servico'), {
        ...mainData,
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
      if (servicos) {
        for (const service of servicos) {
          await addDoc(collection(db, 'ordens_servico', osRef.id, 'servicos'), service);
        }
      }
      if (pecas) {
        for (const part of pecas) {
          await addDoc(collection(db, 'ordens_servico', osRef.id, 'pecas'), part);
        }
      }

      // Handle initial stock reservation if status is approved
      const isApproved = (s: OSStatus) => ['aprovada', 'em_execucao', 'aguardando_peca', 'lavagem'].includes(s);
      if (data.status && isApproved(data.status) && pecas) {
        await runTransaction(db, async (transaction) => {
          await this.handleStockReservation(transaction, osRef.id, empresaId, { ...mainData, numeroOS: lastNumber + 1 } as ServiceOrder, pecas, 'reserve');
        });
      }

      return osRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'ordens_servico');
      return null;
    }
  }

  static async updateOS(osId: string, empresaId: string, data: Partial<ServiceOrder>) {
    try {
      const osRef = doc(db, 'ordens_servico', osId);
      const osSnap = await getDoc(osRef);
      if (!osSnap.exists()) return false;
      const oldData = osSnap.data() as ServiceOrder;
      
      // Update main document
      const { servicos, pecas, ...mainData } = data;
      
      await runTransaction(db, async (transaction) => {
        transaction.update(osRef, {
          ...mainData,
          updatedAt: serverTimestamp()
        });

        // Sync services
        if (servicos) {
          const servicesRef = collection(db, 'ordens_servico', osId, 'servicos');
          const existingServices = await getDocs(servicesRef);
          for (const d of existingServices.docs) {
            transaction.delete(doc(db, 'ordens_servico', osId, 'servicos', d.id));
          }
          for (const service of servicos) {
            const newServiceRef = doc(servicesRef);
            transaction.set(newServiceRef, service);
          }
        }

        // Sync parts
        if (pecas) {
          const partsRef = collection(db, 'ordens_servico', osId, 'pecas');
          const existingParts = await getDocs(partsRef);
          for (const d of existingParts.docs) {
            transaction.delete(doc(db, 'ordens_servico', osId, 'pecas', d.id));
          }
          for (const part of pecas) {
            const newPartRef = doc(partsRef);
            transaction.set(newPartRef, part);
          }
        }

        // Handle Stock Logic
        const isApproved = (s: OSStatus) => ['aprovada', 'em_execucao', 'aguardando_peca', 'lavagem'].includes(s);
        const isFinished = (s: OSStatus) => ['finalizada', 'entregue'].includes(s);

        if (data.status && data.status !== oldData.status) {
          const newStatus = data.status;
          const oldStatus = oldData.status;

          // 1. Reservation Logic
          if (!isApproved(oldStatus) && isApproved(newStatus)) {
            await this.handleStockReservation(transaction, osId, empresaId, { ...oldData, ...data }, pecas || [], 'reserve');
          } else if (isApproved(oldStatus) && !isApproved(newStatus) && !isFinished(newStatus)) {
            await this.handleStockReservation(transaction, osId, empresaId, { ...oldData, ...data }, pecas || [], 'cancel');
          }

          // 2. Completion Logic
          if (!isFinished(oldStatus) && isFinished(newStatus)) {
            await this.processCompletion(transaction, osId, empresaId, { ...oldData, ...data }, pecas || [], servicos || []);
          }
        }
      });

      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ordens_servico/${osId}`);
      return false;
    }
  }

  private static async processCompletion(
    transaction: any, 
    osId: string, 
    empresaId: string, 
    osData: ServiceOrder, 
    parts: any[], 
    services: any[]
  ) {
    const userId = auth.currentUser?.uid || '';

    // Handle stock
    for (const part of parts) {
      if (part.itemId) {
        const itemRef = doc(db, 'inventario', part.itemId);
        const itemSnap = await getDoc(itemRef);
        const itemData = itemSnap.data() as InventoryItem;

        // If it was reserved, we need to decrease both current and reserved
        // If it wasn't reserved, we just decrease current
        const wasReserved = osData.status === 'aprovada' || osData.status === 'em_execucao' || osData.status === 'aguardando_peca';
        
        if (wasReserved) {
          transaction.update(itemRef, {
            quantidadeAtual: increment(-part.quantity),
            quantidadeReservada: increment(-part.quantity),
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.update(itemRef, {
            quantidadeAtual: increment(-part.quantity),
            updatedAt: serverTimestamp()
          });
        }

        const movementRef = doc(collection(db, 'movimentacoes_estoque'));
        transaction.set(movementRef, {
          empresaId,
          itemInventarioId: part.itemId,
          tipo: wasReserved ? 'baixa_reserva' : 'saida',
          origem: 'os',
          ordemServicoId: osId,
          quantidade: part.quantity,
          usuarioId: userId,
          timestamp: new Date().toISOString(),
          reason: `OS #${osData.numeroOS} - Finalizada`
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

    // Generate commissions
    for (const service of services) {
      if (service.tecnicoId && service.comissao > 0) {
        const commissionValue = (service.price * service.quantity) * (service.comissao / 100);
        const commissionRef = doc(collection(db, 'comissoes'));
        transaction.set(commissionRef, {
          empresaId,
          osId,
          osNumero: osData.numeroOS,
          tecnicoId: service.tecnicoId,
          servicoId: service.id,
          servicoNome: service.name,
          valorServico: service.price * service.quantity,
          percentualComissao: service.comissao,
          valorComissao: commissionValue,
          status: 'pending',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  private static async handleStockReservation(
    transaction: any,
    osId: string,
    empresaId: string,
    osData: ServiceOrder,
    parts: any[],
    type: 'reserve' | 'cancel'
  ) {
    const userId = auth.currentUser?.uid || '';

    for (const part of parts) {
      if (part.itemId) {
        const itemRef = doc(db, 'inventario', part.itemId);
        
        transaction.update(itemRef, {
          quantidadeReservada: increment(type === 'reserve' ? part.quantity : -part.quantity),
          updatedAt: serverTimestamp()
        });

        const movementRef = doc(collection(db, 'movimentacoes_estoque'));
        transaction.set(movementRef, {
          empresaId,
          itemInventarioId: part.itemId,
          tipo: type === 'reserve' ? 'reserva' : 'cancelamento_reserva',
          origem: 'os',
          ordemServicoId: osId,
          quantidade: part.quantity,
          usuarioId: userId,
          timestamp: new Date().toISOString(),
          reason: `OS #${osData.numeroOS} - ${type === 'reserve' ? 'Reserva Automática' : 'Cancelamento de Reserva'}`
        });
      }
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
      const oldStatus = osData.status;

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

        // Handle Stock Logic
        const isApproved = (s: OSStatus) => ['aprovada', 'em_execucao', 'aguardando_peca', 'lavagem'].includes(s);
        const isFinished = (s: OSStatus) => ['finalizada', 'entregue'].includes(s);
        const isCancelled = (s: OSStatus) => s === 'cancelada';

        // 1. Reservation Logic
        if (!isApproved(oldStatus) && isApproved(status)) {
          // Moving to approved status -> Reserve
          await this.handleStockReservation(transaction, osId, empresaId, osData, parts, 'reserve');
        } else if (isApproved(oldStatus) && !isApproved(status) && !isFinished(status)) {
          // Moving back from approved status (but not to finished) -> Cancel reservation
          await this.handleStockReservation(transaction, osId, empresaId, osData, parts, 'cancel');
        }

        // 2. Completion Logic
        if (!isFinished(oldStatus) && isFinished(status)) {
          await OSService.processCompletion(transaction, osId, empresaId, { ...osData, status }, parts, []);
        }
      });

      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ordens_servico/${osId}`);
      return false;
    }
  }
}
