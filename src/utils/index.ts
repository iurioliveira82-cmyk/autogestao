import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { auth } from '../firebase';
import { toast } from 'sonner';
import { OperationType } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPlate(plate: string) {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Formata uma data de forma segura, lidando com Timestamps do Firestore,
 * strings de data e objetos Date, evitando o erro "Invalid time value".
 */
export function formatSafeDate(date: any, formatStr: string = 'dd/MM/yyyy'): string {
  if (!date) return 'N/A';
  
  let d: Date;
  
  // Se for um Timestamp do Firestore (objeto com seconds e nanoseconds)
  if (typeof date === 'object' && date.seconds !== undefined) {
    d = new Date(date.seconds * 1000);
  } 
  // Se já for um objeto Date
  else if (date instanceof Date) {
    d = date;
  } 
  // Se for um objeto com método toDate (comum em SDKs do Firebase)
  else if (typeof date === 'object' && typeof date.toDate === 'function') {
    d = date.toDate();
  } 
  // Se for um número (timestamp em ms)
  else if (typeof date === 'number') {
    d = new Date(date);
  } 
  // Se for uma string
  else if (typeof date === 'string') {
    d = new Date(date);
    // Fallback para datas simples YYYY-MM-DD que podem falhar em alguns browsers
    if (isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      d = new Date(date + 'T12:00:00');
    }
  } 
  else {
    return 'Data inválida';
  }
  
  // Verifica se a data resultante é válida
  if (isNaN(d.getTime())) {
    return 'Data inválida';
  }
  
  try {
    return format(d, formatStr, { locale: ptBR });
  } catch (e) {
    return 'Erro na data';
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (error instanceof Error && error.message.includes('permission')) {
    toast.error(`Erro de permissão ao acessar: ${path}`);
  }
  throw new Error(JSON.stringify(errInfo));
}
