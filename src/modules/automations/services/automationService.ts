import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { AutomationRule, Client, ServiceOrder, AutomationLog, OperationType } from '../../../types';
import { handleFirestoreError } from '../../../utils';

export const runAutomationChecks = async (empresaId: string) => {
  try {
    // 1. Update last check time
    const companyRef = doc(db, 'empresas', empresaId);
    await updateDoc(companyRef, { lastAutomationCheck: new Date().toISOString() });

    // 2. Get all active rules
    const rulesQuery = query(
      collection(db, 'automacao_regras'),
      where('empresaId', '==', empresaId),
      where('active', '==', true)
    );
    const rulesSnapshot = await getDocs(rulesQuery);
    const rules: AutomationRule[] = [];
    rulesSnapshot.forEach(doc => rules.push({ id: doc.id, ...doc.data() } as AutomationRule));

    if (rules.length === 0) return { success: true, processed: 0 };

    let processedCount = 0;

    for (const rule of rules) {
      switch (rule.type) {
        case 'revision':
          processedCount += await checkRevisionReminders(empresaId, rule);
          break;
        case 'post-sales':
          processedCount += await checkPostSales(empresaId, rule);
          break;
        case 'birthday':
          processedCount += await checkBirthdays(empresaId, rule);
          break;
        case 'billing':
          processedCount += await checkBilling(empresaId, rule);
          break;
        case 'account-expiration':
          processedCount += await checkAccountExpirations(empresaId, rule);
          break;
        case 'quote-followup':
          processedCount += await checkQuoteFollowups(empresaId, rule);
          break;
        case 'inactive-client':
          processedCount += await checkInactiveClients(empresaId, rule);
          break;
      }
    }

    return { success: true, processed: processedCount };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'automacao_regras');
    return { success: false, error };
  }
};

const checkRevisionReminders = async (empresaId: string, rule: AutomationRule) => {
  // Logic: Find OS delivered exactly X days ago
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - rule.triggerDays);
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const osQuery = query(
    collection(db, 'os'),
    where('empresaId', '==', empresaId),
    where('status', '==', 'entregue'),
    where('updatedAt', '>=', Timestamp.fromDate(startOfDay)),
    where('updatedAt', '<=', Timestamp.fromDate(endOfDay))
  );

  const snapshot = await getDocs(osQuery);
  let count = 0;

  for (const doc of snapshot.docs) {
    const os = { id: doc.id, ...doc.data() } as ServiceOrder;
    const alreadySent = await checkAlreadySent(empresaId, rule.id, os.clienteId, os.id);
    
    if (!alreadySent) {
      await sendAutomation(empresaId, rule, os.clienteId, os.id);
      count++;
    }
  }

  return count;
};

const checkPostSales = async (empresaId: string, rule: AutomationRule) => {
  // Similar to revision but usually 3-7 days
  return await checkRevisionReminders(empresaId, rule);
};

const checkBirthdays = async (empresaId: string, rule: AutomationRule) => {
  const today = new Date();
  const day = today.getDate().toString().padStart(2, '0');
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const birthdayStr = `${month}-${day}`; // MM-DD

  const clientsQuery = query(
    collection(db, 'clientes'),
    where('empresaId', '==', empresaId),
    where('status', '==', 'active')
  );

  const snapshot = await getDocs(clientsQuery);
  let count = 0;

  for (const doc of snapshot.docs) {
    const client = { id: doc.id, ...doc.data() } as Client;
    // Handle YYYY-MM-DD format
    if (client.birthDate && client.birthDate.endsWith(birthdayStr)) {
      const alreadySent = await checkAlreadySent(empresaId, rule.id, client.id);
      if (!alreadySent) {
        await sendAutomation(empresaId, rule, client.id);
        count++;
      }
    }
  }

  return count;
};

const checkBilling = async (empresaId: string, rule: AutomationRule) => {
  // Logic: Find pending accounts receivable due in X days
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - rule.triggerDays);
  
  const dateStr = targetDate.toISOString().split('T')[0];

  const accountsQuery = query(
    collection(db, 'contas_receber'),
    where('empresaId', '==', empresaId),
    where('status', '==', 'pending'),
    where('dueDate', '==', dateStr)
  );

  const snapshot = await getDocs(accountsQuery);
  let count = 0;

  for (const doc of snapshot.docs) {
    const account = doc.data();
    const alreadySent = await checkAlreadySent(empresaId, rule.id, account.clienteId, doc.id);
    if (!alreadySent) {
      await sendAutomation(empresaId, rule, account.clienteId, doc.id);
      count++;
    }
  }

  return count;
};

const checkAccountExpirations = async (empresaId: string, rule: AutomationRule) => {
  // Similar to billing but for payables (maybe internal notification?)
  // For now, same logic as billing but for receivables
  return await checkBilling(empresaId, rule);
};

const checkQuoteFollowups = async (empresaId: string, rule: AutomationRule) => {
  // Logic: Find quotes sent X days ago still pending
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - rule.triggerDays);
  const dateStr = targetDate.toISOString().split('T')[0];

  const quotesQuery = query(
    collection(db, 'orcamentos'),
    where('empresaId', '==', empresaId),
    where('status', '==', 'sent'),
    where('createdAt', '>=', dateStr + 'T00:00:00'),
    where('createdAt', '<=', dateStr + 'T23:59:59')
  );

  const snapshot = await getDocs(quotesQuery);
  let count = 0;

  for (const doc of snapshot.docs) {
    const quote = doc.data();
    const alreadySent = await checkAlreadySent(empresaId, rule.id, quote.clienteId, doc.id);
    if (!alreadySent) {
      await sendAutomation(empresaId, rule, quote.clienteId, doc.id);
      count++;
    }
  }

  return count;
};

const checkInactiveClients = async (empresaId: string, rule: AutomationRule) => {
  // Logic: Find clients whose last OS was X days ago
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - rule.triggerDays);
  const dateStr = targetDate.toISOString().split('T')[0];

  const clientsQuery = query(
    collection(db, 'clientes'),
    where('empresaId', '==', empresaId),
    where('status', '==', 'active'),
    where('lastServiceDate', '<=', dateStr + 'T23:59:59')
  );

  const snapshot = await getDocs(clientsQuery);
  let count = 0;

  for (const doc of snapshot.docs) {
    const client = { id: doc.id, ...doc.data() } as Client;
    const alreadySent = await checkAlreadySent(empresaId, rule.id, client.id);
    if (!alreadySent) {
      await sendAutomation(empresaId, rule, client.id);
      count++;
    }
  }

  return count;
};

const checkAlreadySent = async (empresaId: string, ruleId: string, clienteId: string, relatedId?: string) => {
  const logsQuery = query(
    collection(db, 'automacao_logs'),
    where('empresaId', '==', empresaId),
    where('ruleId', '==', ruleId),
    where('clienteId', '==', clienteId),
    where('relatedId', '==', relatedId || null)
  );

  const snapshot = await getDocs(logsQuery);
  return !snapshot.empty;
};

const sendAutomation = async (empresaId: string, rule: AutomationRule, clienteId: string, relatedId?: string) => {
  try {
    // 1. Create Log
    const logId = `log_${Math.random().toString(36).substr(2, 9)}`;
    const logData: Partial<AutomationLog> = {
      empresaId,
      ruleId: rule.id,
      clienteId,
      relatedId: relatedId || null,
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    await addDoc(collection(db, 'automacao_logs'), logData);

    // 2. Mock Send (WhatsApp/Email)
    console.log(`[AUTOMATION] Sending ${rule.channel} to client ${clienteId}: ${rule.messageTemplate}`);
    
    return true;
  } catch (error) {
    console.error('Error sending automation:', error);
    return false;
  }
};
