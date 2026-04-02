import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { 
  getFirestore as getClientFirestore, 
  collection as clientCollection, 
  getDocs as clientGetDocs, 
  limit as clientLimit, 
  query as clientQuery,
  where as clientWhere,
  orderBy as clientOrderBy,
  addDoc as clientAddDoc,
  updateDoc as clientUpdateDoc,
  deleteDoc as clientDeleteDoc,
  doc as clientDoc,
  getDoc as clientGetDoc,
  serverTimestamp as clientServerTimestamp
} from 'firebase/firestore';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');

let firestoreDatabaseId: string | undefined;
let _isUsingClientSdk = false;

if (admin.apps.length === 0) {
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
  
  // Try to detect project ID from metadata server
  let projectId = config.projectId;
  
  // We'll do a quick check for the metadata project ID
  // Since we're in an async block already, we can't easily do it here synchronously
  // but we can use the fallback logic we already have.
  
  console.log('[FirebaseAdmin] Initializing with Project ID:', projectId);
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId,
    });
  } catch (err: any) {
    console.error('[FirebaseAdmin] Failed to initialize:', err.message);
    admin.initializeApp();
  }
  
  firestoreDatabaseId = config.firestoreDatabaseId;
  console.log('[FirebaseAdmin] Initialized. Project ID:', admin.app().options.projectId);
  console.log('[FirebaseAdmin] Configured Database ID:', firestoreDatabaseId || '(default)');
} else {
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
  firestoreDatabaseId = config.firestoreDatabaseId;
}

const app = admin.app();

// Helper to create a Firestore instance
const createDbInstance = (dbId?: string, projectId?: string) => {
  if (projectId && projectId !== app.options.projectId) {
    const appName = `app-${projectId}`;
    let targetApp = admin.apps.find(a => a?.name === appName);
    if (!targetApp) {
      targetApp = admin.initializeApp({
        projectId,
        credential: admin.credential.applicationDefault(),
      }, appName);
    }
    return getFirestore(targetApp, dbId && dbId !== '(default)' ? dbId : undefined);
  }
  return getFirestore(app, dbId && dbId !== '(default)' ? dbId : undefined);
};

let _db: any = createDbInstance(firestoreDatabaseId);

export const getDb = () => _db;
export const isUsingClientSdk = () => _isUsingClientSdk;

// Wrapper functions to handle both Admin and Client SDKs
export const getCollection = (path: string) => {
  if (_isUsingClientSdk) {
    return clientCollection(_db, path);
  }
  return _db.collection(path);
};

export const getDocuments = async (queryRef: any) => {
  if (_isUsingClientSdk) {
    const snapshot = await clientGetDocs(queryRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
  }
  const snapshot = await queryRef.get();
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
};

export const applyQuery = (collectionRef: any, constraints: any[]) => {
  if (_isUsingClientSdk) {
    return clientQuery(collectionRef, ...constraints);
  }
  let query = collectionRef;
  for (const c of constraints) {
    if (c.type === 'where') query = query.where(c.field, c.op, c.value);
    if (c.type === 'orderBy') query = query.orderBy(c.field, c.dir);
    if (c.type === 'limit') query = query.limit(c.value);
  }
  return query;
};

export const qWhere = (field: string, op: any, value: any) => {
  if (_isUsingClientSdk) return clientWhere(field, op, value);
  return { type: 'where', field, op, value };
};

export const qOrderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => {
  if (_isUsingClientSdk) return clientOrderBy(field, dir);
  return { type: 'orderBy', field, dir };
};

export const qLimit = (value: number) => {
  if (_isUsingClientSdk) return clientLimit(value);
  return { type: 'limit', value };
};

export const addDocument = async (collectionPath: string, data: any) => {
  if (_isUsingClientSdk) {
    const docRef = await clientAddDoc(clientCollection(_db, collectionPath), {
      ...data,
      createdAt: clientServerTimestamp(),
      updatedAt: clientServerTimestamp()
    });
    return { id: docRef.id };
  }
  const docRef = await _db.collection(collectionPath).add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { id: docRef.id };
};

export const updateDocument = async (collectionPath: string, id: string, data: any) => {
  if (_isUsingClientSdk) {
    const docRef = clientDoc(_db, collectionPath, id);
    await clientUpdateDoc(docRef, {
      ...data,
      updatedAt: clientServerTimestamp()
    });
    return { id };
  }
  const docRef = _db.collection(collectionPath).doc(id);
  await docRef.update({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { id };
};

export const deleteDocument = async (collectionPath: string, id: string) => {
  if (_isUsingClientSdk) {
    const docRef = clientDoc(_db, collectionPath, id);
    await clientDeleteDoc(docRef);
    return { id };
  }
  await _db.collection(collectionPath).doc(id).delete();
  return { id };
};

export const getDocument = async (collectionPath: string, id: string) => {
  if (_isUsingClientSdk) {
    const docRef = clientDoc(_db, collectionPath, id);
    const snapshot = await clientGetDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }
  const doc = await _db.collection(collectionPath).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

// Test connection and implement fallback
(async () => {
  const testConnection = async (targetDb: any, label: string) => {
    try {
      if (!targetDb) return false;
      const dbId = (targetDb as any)._databaseId || (targetDb as any).databaseId || '(default)';
      const projId = (targetDb as any)._projectId || (targetDb as any).projectId || app.options.projectId;
      console.log(`[FirebaseAdmin] Testing ${label} (ID: ${dbId}) on project: ${projId}`);
      
      // Check if it's Admin SDK (has collection method)
      if (typeof targetDb.collection === 'function') {
        await targetDb.collection('transacoes_financeiras').limit(1).get();
        console.log(`[FirebaseAdmin] ${label} (Admin SDK) test successful.`);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(`[FirebaseAdmin] ${label} test failed:`, err.message);
      return false;
    }
  };

  const success = await testConnection(_db, 'Primary Admin Database');
  
  if (!success) {
    console.warn('[FirebaseAdmin] Primary admin database failed. Trying fallback to (default)...');
    const fallbackDb = createDbInstance();
    const fallbackSuccess = await testConnection(fallbackDb, 'Fallback Admin Database');
    
    if (fallbackSuccess) {
      console.log('[FirebaseAdmin] Fallback to (default) admin database successful. Updating active instance.');
      _db = fallbackDb;
    } else {
      console.warn('[FirebaseAdmin] All Admin SDK attempts failed. Attempting Client SDK fallback as a workaround...');
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const clientApp = initializeClientApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          appId: config.appId
        });
        const clientDb = getClientFirestore(clientApp, config.firestoreDatabaseId);
        
        // Test client SDK
        const q = clientQuery(clientCollection(clientDb, 'transacoes_financeiras'), clientLimit(1));
        await clientGetDocs(q);
        
        console.log('[FirebaseAdmin] Client SDK fallback successful. Using Client SDK for Firestore operations.');
        _db = clientDb;
        _isUsingClientSdk = true;
      } catch (clientErr: any) {
        console.error('[FirebaseAdmin] Client SDK fallback also failed:', clientErr.message);
      }
    }
  }
})();


export { _db as db };

export default admin;
