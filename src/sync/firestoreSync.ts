import { collection, doc, writeBatch, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db_firestore, isFirebaseConfigured, auth as firebaseAuth } from '../firebase';
import { db } from '../db';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth?.currentUser?.uid,
      email: firebaseAuth?.currentUser?.email,
      emailVerified: firebaseAuth?.currentUser?.emailVerified,
      isAnonymous: firebaseAuth?.currentUser?.isAnonymous,
      tenantId: firebaseAuth?.currentUser?.tenantId,
      providerInfo: firebaseAuth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Perform a cold pull from Firestore collections and overwrite older local records.
 */
export async function coldPullFromFirestore(uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db_firestore) {
    console.log('Firebase Firestore is not configured. Skipping cold pull.');
    return;
  }

  try {
    // 1. Fetch spaces
    const spacesPath = `users/${uid}/spaces`;
    let spacesSnapshot;
    try {
      spacesSnapshot = await getDocs(collection(db_firestore, spacesPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, spacesPath);
      return;
    }

    const spacesDocs = spacesSnapshot.docs;
    for (const d of spacesDocs) {
      const id = parseInt(d.id, 10);
      if (isNaN(id)) continue;
      const remoteData = d.data();
      const local = await db.spaces.get(id);
      if (!local || (remoteData.updatedAt || 0) > (local.updatedAt || 0)) {
        await db.spaces.put({ id, ...remoteData } as any);
      }
    }

    // 2. Fetch pages
    const pagesPath = `users/${uid}/pages`;
    let pagesSnapshot;
    try {
      pagesSnapshot = await getDocs(collection(db_firestore, pagesPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, pagesPath);
      return;
    }

    const pagesDocs = pagesSnapshot.docs;
    for (const d of pagesDocs) {
      const id = parseInt(d.id, 10);
      if (isNaN(id)) continue;
      const remoteData = d.data();
      const local = await db.pages.get(id);
      if (!local || (remoteData.updatedAt || 0) > (local.updatedAt || 0)) {
        await db.pages.put({ id, ...remoteData } as any);
      }
    }

    // 3. Fetch entries (tasks)
    const entriesPath = `users/${uid}/entries`;
    let entriesSnapshot;
    try {
      entriesSnapshot = await getDocs(collection(db_firestore, entriesPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, entriesPath);
      return;
    }

    const entriesDocs = entriesSnapshot.docs;
    for (const d of entriesDocs) {
      const id = parseInt(d.id, 10);
      if (isNaN(id)) continue;
      const remoteData = d.data();
      const local = await db.entries.get(id);
      if (!local || (remoteData.updatedAt || 0) > (local.updatedAt || 0)) {
        await db.entries.put({ id, ...remoteData } as any);
      }
    }

    console.log('Firebase cold pull synchronization complete.');
  } catch (error) {
    console.error('Error during Firebase pull:', error);
  }
}

let debounceTimer: any = null;

/**
 * Creates and returns a scheduling function to sync all current local records to Firestore
 * with a 3-second debounce.
 */
export function createSyncEngine(uid: string) {
  return () => {
    if (!isFirebaseConfigured || !db_firestore) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        const spacesList = await db.spaces.toArray();
        const pagesList = await db.pages.toArray();
        const entriesList = await db.entries.toArray();

        const allOperations: { path: string; id: string; data: any }[] = [];

        spacesList.forEach(sp => {
          if (sp.id) {
            allOperations.push({
              path: `users/${uid}/spaces`,
              id: sp.id.toString(),
              data: { ...sp }
            });
          }
        });

        pagesList.forEach(pg => {
          if (pg.id) {
            allOperations.push({
              path: `users/${uid}/pages`,
              id: pg.id.toString(),
              data: { ...pg }
            });
          }
        });

        entriesList.forEach(ent => {
          if (ent.id) {
            allOperations.push({
              path: `users/${uid}/entries`,
              id: ent.id.toString(),
              data: { ...ent }
            });
          }
        });

        // Write batch size limit in Firestore is 500 documents
        const batchSize = 500;
        for (let i = 0; i < allOperations.length; i += batchSize) {
          const chunk = allOperations.slice(i, i + batchSize);
          const batch = writeBatch(db_firestore!);

          chunk.forEach(op => {
            const docRef = doc(db_firestore!, op.path, op.id);
            batch.set(docRef, op.data, { merge: true });
          });

          try {
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${uid}/(batch-chunk)`);
          }
        }
        console.log('Firestore debounced push completed successfully.');
      } catch (err) {
        console.error('Error during firestore sync batch writes:', err);
      }
    }, 3000);
  };
}

/**
 * Explicit helper to delete a Firestore document instantly on a delete event.
 */
export async function deleteFromFirestore(
  uid: string,
  collectionName: 'spaces' | 'pages' | 'entries',
  id: string | number
): Promise<void> {
  if (!isFirebaseConfigured || !db_firestore) {
    return;
  }

  const path = `users/${uid}/${collectionName}`;
  const docId = id.toString();
  try {
    const docRef = doc(db_firestore, path, docId);
    await deleteDoc(docRef);
    console.log(`Successfully deleted document ${collectionName}/${docId} from Firestore.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${docId}`);
  }
}

/**
 * Direct cascading space deletion from Firestore. Finds all entries and pages 
 * belonging to spaceId and triggers a batch write deletion in Firestore.
 */
export async function deleteSpaceCascadingFromFirestore(
  uid: string,
  spaceId: number
): Promise<void> {
  if (!isFirebaseConfigured || !db_firestore) {
    return;
  }

  try {
    const batch = writeBatch(db_firestore);

    // Query and queue deletion for entries
    const entriesPath = `users/${uid}/entries`;
    const entriesQuery = query(collection(db_firestore, entriesPath), where('spaceId', '==', spaceId));
    const entriesSnapshot = await getDocs(entriesQuery);
    entriesSnapshot.docs.forEach(d => {
      batch.delete(d.ref);
    });

    // Query and queue deletion for pages
    const pagesPath = `users/${uid}/pages`;
    const pagesQuery = query(collection(db_firestore, pagesPath), where('spaceId', '==', spaceId));
    const pagesSnapshot = await getDocs(pagesQuery);
    pagesSnapshot.docs.forEach(d => {
      batch.delete(d.ref);
    });

    // Queue deletion for the space target itself
    const spaceDocRef = doc(db_firestore, `users/${uid}/spaces`, spaceId.toString());
    batch.delete(spaceDocRef);

    // Commit the entire cascading batch write
    await batch.commit();
    console.log(`Successfully completed cascading space deletion for spaceId ${spaceId} from Firestore.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}/spaces/${spaceId} (cascading)`);
  }
}
