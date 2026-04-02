import { getDb } from './server/lib/firebase-admin';

async function runTest() {
  console.log('Starting Firebase connection test script...');
  // Wait for the async initialization in firebase-admin.ts to complete
  await new Promise(resolve => setTimeout(resolve, 5000));
  const db = getDb();
  const dbId = (db as any)._databaseId || (db as any).databaseId || '(default)';
  console.log('Final Active Database ID:', dbId);
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
