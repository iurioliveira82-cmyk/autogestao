import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy, 
  limit,
  onSnapshot,
  QueryConstraint,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError } from '../utils';
import { OperationType } from '../types';

export class FirestoreService {
  static async getByEmpresa<T>(collectionName: string, empresaId: string, constraints: QueryConstraint[] = []) {
    const q = query(
      collection(db, collectionName),
      where('empresaId', '==', empresaId),
      ...constraints
    );
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, collectionName);
      return [];
    }
  }

  static subscribeByEmpresa<T>(collectionName: string, empresaId: string, callback: (data: T[]) => void, constraints: QueryConstraint[] = []) {
    const q = query(
      collection(db, collectionName),
      where('empresaId', '==', empresaId),
      ...constraints
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    });
  }

  static async create<T>(collectionName: string, data: any) {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionName);
      return null;
    }
  }

  static async update(collectionName: string, id: string, data: any) {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
      return false;
    }
  }

  static async delete(collectionName: string, id: string) {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
      return false;
    }
  }

  static async getById<T>(collectionName: string, id: string) {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${collectionName}/${id}`);
      return null;
    }
  }

  static async getSubcollection<T>(parentCollection: string, parentId: string, subcollectionName: string) {
    try {
      const q = collection(db, parentCollection, parentId, subcollectionName);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `${parentCollection}/${parentId}/${subcollectionName}`);
      return [];
    }
  }

  static subscribeSubcollection<T>(parentCollection: string, parentId: string, subcollectionName: string, callback: (data: T[]) => void) {
    const q = collection(db, parentCollection, parentId, subcollectionName);
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `${parentCollection}/${parentId}/${subcollectionName}`);
    });
  }

  static async addSubcollectionDoc(parentCollection: string, parentId: string, subcollectionName: string, data: any) {
    try {
      const docRef = await addDoc(collection(db, parentCollection, parentId, subcollectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${parentCollection}/${parentId}/${subcollectionName}`);
      return null;
    }
  }
}
