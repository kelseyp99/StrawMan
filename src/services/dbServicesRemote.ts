// CHANGELOG (2025-06-02):
// - Added syncRealmRowsToFirestore(tableName: string, realmRows: any[]): Promise<string[]> to upload only new/unsynced Realm rows to Firestore (Users/{uid}/{tableName}).
//   This function does not perform any download or update from Firestore to Realm, and is not related to previous .NET API or bidirectional sync logic.
//   Use this for one-way upload of new Realm data to Firestore only.

import { auth, db } from '../firebaseConfig';
import { realm } from '../realmConfig';
import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  query,
  where,
  getDoc,
  startAfter,
  deleteField,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  limit,
  onSnapshot,
  orderBy,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getUID } from '../utils/uidManager';
import { format } from 'date-fns';
import { sendQuestionForParsing, sendQuestion } from './openaiAPI';
import { ActivityLog } from './types';
import { addChangeLogEntry } from './dbServices';
import { ENABLE_DISCUSSION_SYNC, ENABLE_ACTIVITYLOG_SYNC, ENABLE_CATEGORY_SYNC, ACTIVITYLOG_ONE_TIME_IMPORT } from './syncConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Interfaces (same as dbServicesLocal.ts)
interface Discussion {
  id: string;
  discussionId?: string;
  description: string;
  timestamp: Date | string;
  typeSay?: string;
  cleared: boolean;
  uid?: string;
}

export interface Parameters {
  parameterName: string;
  parameterValue?: string;
}

interface Alert {
  id: string;
  message: string;
  timestamp: Date;
  severity: string;
  isActive: boolean;
  nextTrigger: Date;
  createdAt: Date;
  uid: string;
}

interface GPTSpecialty {
  id: string;
  name: string;
  url: string;
  apiKey: string;
}

// Define DiscussionCount interface for Firebase
export interface DiscussionCount {
  id?: string;
  discussionId: string;
  count: number;
  description: string;
  timestamp: Date | string;
  uid?: string;
}

// Define Category interface for Firebase
export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  synced: boolean;
  syncTimestamp?: Date | Timestamp;
  uid: string;
}

// Fet

export const findDuplicateActivityLog = async (
  discussionId: string,
  category: string,
  description: string,
  uid: string
): Promise<ActivityLog | null> => {
  // Use user-level collection instead of root collection
  const q = query(
    collection(db, `Users/${uid}/ActivityLog`),
    where('discussionId', '==', discussionId),
    where('category', '==', category),
    where('description', '==', description),
    where('uid', '==', uid)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty
    ? null
    : ({
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      } as unknown as ActivityLog);
};

const getDiscussionCountsQuery = async () => {
  const uid = await getUID();
  return query(collection(db, `Users/${uid}/DiscussionCounts`));
};

// Existing functions (from previous response, abbreviated)
export async function initializeUser(): Promise<void> {
  const uid = await getUID();
  if (!uid) throw new Error('No user signed in');
  try {
    console.log(`Initializing user for UID: ${uid}`);
    await setDoc(
      doc(db, `Users/${uid}`),
      {
        id: uid,
        appVersion: '1.1.0',
        appId: 'com.anonymous.lifelog',
        timestamp: new Date(),
        uid,
        isPaid: false,
      },
      { merge: true }
    );
    console.log('User initialized in Firestore');
  } catch (error) {
    console.error('Error initializing user:', error);
    throw error;
  }
}

export async function addOrUpdateDiscussion(
  description: string,
  typeSay: string = 'tell',
  id?: string
): Promise<string> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  try {
    const discussionId = id || Date.now().toString();
    await setDoc(
      doc(db, `Users/${uid}/Discussion`, discussionId),
      {
        id: discussionId,
        discussionId: discussionId,
        description,
        typeSay,
        cleared: false,
        timestamp: new Date(),
        uid,
      },
      { merge: true }
    );
    console.log(
      `Discussion ${id ? 'updated' : 'added'} in Firestore: ${discussionId}`
    );
    return discussionId;
  } catch (error) {
    console.error('Error in addOrUpdateDiscussion:', error);
    throw error;
  }
}

// ... other existing functions (getDiscussions, addOrUpdateGPTResponse, etc.) ...

// New functions
export async function deactivateAlertByKey(key: string): Promise<void> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  try {
    await setDoc(
      doc(db, `Users/${uid}/Alert`, String(key)),
      { isActive: false },
      { merge: true }
    );
    console.log(`Alert ${key} deactivated in Firestore`);
  } catch (error) {
    console.error('Error in deactivateAlertByKey:', error);
    throw error;
  }
}

export async function updateGPTSpecialties(gptSpecialty: {
  id?: number;
  name: string;
  url: string;
  apiKey: string;
}): Promise<void> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  try {
    const id = gptSpecialty.id || new Date().getTime();
    await setDoc(
      doc(db, `Users/${uid}/GPTSpecialties`, String(id)),
      {
        id,
        name: gptSpecialty.name,
        url: gptSpecialty.url,
        apiKey: gptSpecialty.apiKey,
      },
      { merge: true }
    );
    console.log('GPT Specialty updated in Firestore');
  } catch (error) {
    console.error('Error in updateGPTSpecialties:', error);
    throw error;
  }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  try {
    const snapshot = await getDocs(collection(db, `Users/${uid}/ActivityLog`));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      discussionId: doc.data().discussionId,
      category: doc.data().category,
      description: doc.data().description,
      timestamp: doc.data().timestamp.toDate(),
      cleared: doc.data().cleared,
      responseType: doc.data().responseType,
      uid: doc.data().uid,
      synced: doc.data().synced || false,
      syncTimestamp: doc.data().syncTimestamp?.toDate(),
      lockedCategory: doc.data().lockedCategory ?? false,
      lockedDescription: doc.data().lockedDescription ?? false,
    }));
  } catch (error) {
    console.error('Error in getActivityLogs:', error);
    return [];
  }
}

export async function getParameters(): Promise<Parameters[]> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  try {
    const snapshot = await getDocs(collection(db, `Users/${uid}/Parameters`));
    return snapshot.docs.map((doc) => ({
      parameterName: doc.data().parameterName,
      parameterValue: doc.data().parameterValue,
    }));
  } catch (error) {
    console.error('Error in getParameters:', error);
    return [];
  }
}

export async function getDescriptionsWithTimestamps(
  categories: string[]
): Promise<string> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  try {
    const q = query(
      collection(db, `Users/${uid}/ActivityLog`),
      where(
        'category',
        'in',
        categories.length > 0 ? categories : ['uncategorized']
      )
    );
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((doc) => ({
      description: doc.data().description,
      timestamp: doc.data().timestamp.toDate().toISOString(),
    }));
    return JSON.stringify(logs);
  } catch (error) {
    console.error('Error in getDescriptionsWithTimestamps:', error);
    return '[]';
  }
}

export const createDocument = async (data: any) => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for create operation');
  }
  try {
    const docRef = await addDoc(collection(db, `Users/${uid}/Documents`), {
      ...data,
      uid,
      timestamp: new Date(),
    });
    console.log('Document created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

export const readDocuments = async () => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for read operation');
  }
  try {
    const q = query(
      collection(db, `Users/${uid}/Documents`),
      where('uid', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    console.log('Documents retrieved:', documents);
    return documents;
  } catch (error) {
    console.error('Error reading documents:', error);
    throw error;
  }
};

export const updateDocument = async (docId: string, data: any) => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for update operation');
  }
  try {
    const docRef = doc(db, `Users/${uid}/Documents`, docId);
    await updateDoc(docRef, data);
    console.log('Document updated with ID:', docId);
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

export const deleteDocument = async (docId: string) => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for delete operation');
  }
  try {
    const docRef = doc(db, `Users/${uid}/Documents`, docId);
    await deleteDoc(docRef);
    console.log('Document deleted with ID:', docId);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

//////////////////////////////////////////
// Database functions for ActivityLog //
//////////////////////////////////////////

export async function getDistinctCategories(): Promise<string[]> {
  console.log('Fetching distinct categories from Firestore...');
  const uid = await getUID();
  if (!uid) {
    console.error('No UID available.');
    return [];
  }
  try {
    const snapshot = await getDocs(collection(db, `Users/${uid}/ActivityLog`));
    const categoriesSet = new Set<string>();

    try {
      snapshot.forEach((doc: { data: () => any }) => {
        const data = doc.data();
        if (data.category) {
          categoriesSet.add(data.category);
        }
      });
      if (categoriesSet.has('Uncategorized')) {
        categoriesSet.delete('Uncategorized');
      }
      if (categoriesSet.size === 0) {
        categoriesSet.add('diet');
      }
    } catch (error) {
      console.error('Error processing ActivityLog responses:', error);
    }

    return Array.from(categoriesSet);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

export async function insertJsonFile(jsonData: any): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for insert operation');
  }
  try {
    for (const item of jsonData) {
      const docRef = doc(
        collection(db, `Users/${uid}/ActivityLog`),
        String(Date.now())
      );
      const newEntry = {
        category: item.category,
        value: item.value,
        timestamp: new Date(),
        uid,
      };
      await setDoc(docRef, newEntry);
    }
    console.log('Data inserted successfully!');
  } catch (error) {
    console.error('Error inserting data:', error);
  }
}

export async function queryAllFieldsByCategories(
  categories: string[]
): Promise<any[]> {
  console.log('Querying Firestore for categories:', categories);
  const uid = await getUID();
  if (!uid) {
    console.error('No UID available.');
    return [];
  }
  try {
    const q = query(
      collection(db, `Users/${uid}/ActivityLog`),
      where(
        'category',
        'in',
        categories.length > 0 ? categories : ['uncategorized']
      )
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data() as ActivityLog;
      const timestamp = new Date(data.timestamp);
      const formattedTimestamp = `${
        timestamp.getMonth() + 1
      }/${timestamp.getDate()}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      return `${formattedTimestamp} ${data.description}`;
    });
  } catch (error) {
    console.error('Error querying Firestore:', error);
    return [];
  }
}

export async function synchronizeActivityLog(
  appVersion: string
): Promise<void> {
  if (!ENABLE_ACTIVITYLOG_SYNC) {
    console.log('ActivityLog synchronization disabled.');
    return;
  }

  try {
    console.log(`Starting ActivityLog sync (legacy import via Realm) with appVersion: ${appVersion}`);
    
    // Check if one-time import has already been completed
    if (ACTIVITYLOG_ONE_TIME_IMPORT) {
      const importCompleted = await AsyncStorage.getItem('activityLogImportCompleted');
      if (importCompleted === 'true') {
        console.log('ActivityLog one-time import already completed. Skipping sync.');
        return;
      }
    }
    
    const uid = await getUID();
    if (!uid) {
      console.error('No user ID for ActivityLog synchronization.');
      return;
    }

    console.log(`Synchronizing ActivityLog for UID: ${uid} (Legacy app does NOT write to ActivityLog - one-time import)`);
    
    // Step 1: Check Realm is initialized
    if (!realm) {
      console.error('Realm not initialized');
      return;
    }
    
    // Step 2: ONLY read from root /ActivityLog collection
    const globalActivityLogQuery = query(collection(db, 'ActivityLog'));
    const globalSnapshot = await getDocs(globalActivityLogQuery);
    console.log(
      `Found ${globalSnapshot.docs.length} global ActivityLog entries to import`
    );

    let importedCount = 0;
    for (const globalDoc of globalSnapshot.docs) {
      const globalData = globalDoc.data() as ActivityLog;
      if (globalData.uid && globalData.uid !== uid) {
        console.log(
          `Skipping ActivityLog ${globalDoc.id} (owned by ${globalData.uid})`
        );
        continue;
      }

      // Step 3: Use timestamp as unique identifier to prevent duplicates
      const entryTimestamp = globalData.timestamp instanceof Date ? globalData.timestamp : 
                           (globalData.timestamp as any)?.toDate ? (globalData.timestamp as any).toDate() : new Date();
      
      // Check if entry with this timestamp already exists in Realm
      const existingEntryByTimestamp = realm.objects('ActivityLog').filtered('timestamp = $0', entryTimestamp);
      if (existingEntryByTimestamp.length > 0) {
        console.log(`ActivityLog with timestamp ${entryTimestamp.toISOString()} already exists in Realm`);
        continue;
      }

      // Generate consistent ID based on timestamp to avoid duplicates
      const timestampId = entryTimestamp.getTime().toString();
      const existingEntryById = realm.objectForPrimaryKey('ActivityLog', timestampId);
      
      if (!existingEntryById) {
        // Step 4: Write to Realm first (this will then sync to Users/{uid}/ActivityLog via existing sync)
        realm.write(() => {
          realm!.create('ActivityLog', {
            id: timestampId, // Use timestamp-based ID for consistency
            discussionId: globalData.discussionId || timestampId,
            categoryId: globalData.category || 'uncategorized',
            category: globalData.category || 'uncategorized',
            description: globalData.description || '',
            timestamp: entryTimestamp,
            cleared: globalData.cleared || false,
            synced: false, // Mark as unsynced so it will be uploaded to Users/{uid}/ActivityLog
            uid: uid,
          });
        });
        console.log(`Imported ActivityLog ${timestampId} (timestamp: ${entryTimestamp.toISOString()}) to Realm`);
        importedCount++;
      } else {
        console.log(`ActivityLog ${timestampId} already exists in Realm`);
      }
    }

    console.log(`ActivityLog synchronization (legacy import via Realm) completed. Imported ${importedCount} entries.`);
    
    // Step 5: Trigger sync from Realm to Users/{uid}/ActivityLog
    if (importedCount > 0) {
      console.log('Triggering sync of imported ActivityLog entries to Users/{uid}/ActivityLog...');
      await syncRealmRowsToFirestore('ActivityLog', realm.objects('ActivityLog').filtered('synced = false').map(obj => obj.toJSON()));
    }
    
    // Mark one-time import as completed
    if (ACTIVITYLOG_ONE_TIME_IMPORT) {
      await AsyncStorage.setItem('activityLogImportCompleted', 'true');
      console.log('ActivityLog one-time import marked as completed.');
    }
  } catch (error) {
    console.error('Error synchronizing ActivityLog:', error);
    throw error;
  }
}

export async function synchronizeDiscussions(
  appVersion: string
): Promise<void> {
  if (!ENABLE_DISCUSSION_SYNC) {
    console.log('Discussion synchronization disabled.');
    return;
  }

  try {
    if (!compareVersions(appVersion, '1.1.0')) {
      console.log('Skipping sync for version >= 1.1.0');
      return;
    }

    const uid = await getUID();
    if (!uid) {
      console.error('No user ID for synchronization.');
      return;
    }

    console.log(`Synchronizing Discussion for UID: ${uid} (Legacy app continues to write - ongoing sync needed)`);

    // Step 1: Check Realm is initialized
    if (!realm) {
      console.error('Realm not initialized');
      return;
    }

    // Step 2: ONLY read from root Discussion collection
    const globalDiscussionQuery = query(collection(db, 'Discussion'));
    const globalSnapshot = await getDocs(globalDiscussionQuery);
    console.log(
      `Found ${globalSnapshot.docs.length} global Discussion entries to import`
    );

    let importedCount = 0;
    for (const globalDoc of globalSnapshot.docs) {
      const globalData = globalDoc.data() as Discussion;
      if (globalData.uid && globalData.uid !== uid) {
        console.log(
          `Skipping Discussion ${globalDoc.id} (owned by ${globalData.uid})`
        );
        continue;
      }

      // Step 3: Use timestamp as unique identifier to prevent duplicates
      const entryTimestamp = globalData.timestamp instanceof Date ? globalData.timestamp :
                           (globalData.timestamp as any)?.toDate ? (globalData.timestamp as any).toDate() : new Date();
      
      // Check if entry with this timestamp already exists in Realm
      const existingEntryByTimestamp = realm.objects('Discussion').filtered('timestamp = $0', entryTimestamp);
      if (existingEntryByTimestamp.length > 0) {
        console.log(`Discussion with timestamp ${entryTimestamp.toISOString()} already exists in Realm`);
        continue;
      }

      // Generate consistent ID based on timestamp to avoid duplicates
      const timestampId = entryTimestamp.getTime().toString();
      const existingEntryById = realm.objectForPrimaryKey('Discussion', timestampId);
      
      if (!existingEntryById) {
        // Step 4: Write to Realm first (this will then sync to Users/{uid}/Discussion via existing sync)
        realm.write(() => {
          realm!.create('Discussion', {
            id: timestampId, // Use timestamp-based ID for consistency
            discussionId: timestampId, // Keep consistent with ID
            description: globalData.description || '',
            timestamp: entryTimestamp,
            typeSay: globalData.typeSay || '',
            cleared: globalData.cleared || false,
            synced: false, // Mark as unsynced so it will be uploaded to Users/{uid}/Discussion
            uid: uid,
          });
        });
        console.log(`Imported Discussion ${timestampId} (timestamp: ${entryTimestamp.toISOString()}) to Realm`);
        importedCount++;
      } else {
        console.log(`Discussion ${timestampId} already exists in Realm`);
      }
    }

    console.log(`Discussion synchronization (legacy import via Realm) completed. Imported ${importedCount} entries.`);
    
    // Step 5: Trigger sync from Realm to Users/{uid}/Discussion
    if (importedCount > 0) {
      console.log('Triggering sync of imported Discussion entries to Users/{uid}/Discussion...');
      await syncRealmRowsToFirestore('Discussion', realm.objects('Discussion').filtered('synced = false').map(obj => obj.toJSON()));
    }
  } catch (error) {
    console.error('Error synchronizing Discussion:', error);
    if ((error as any).code === 'permission-denied') {
      console.error(
        'Permission denied. Check Firestore security rules for /Discussion and Users/{uid}/Discussion.'
      );
    }
    throw error;
  }
}

export async function synchronizeCategories(appVersion: string): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for category synchronization');
  }

  console.log(`Synchronizing Categories for UID: ${uid}`);

  try {
    // Get all unique categories from ActivityLog entries in Firestore
    const activityLogsQuery = query(collection(db, `Users/${uid}/ActivityLog`));
    const activityLogsSnap = await getDocs(activityLogsQuery);

    const categories = new Set<string>();
    activityLogsSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.category && data.category !== 'uncategorized') {
        categories.add(data.category);
      }
    });

    // Sync categories to the Category collection
    const batch = writeBatch(db);

    for (const categoryName of categories) {
      const categoryQuery = query(
        collection(db, `Users/${uid}/Category`),
        where('name', '==', categoryName)
      );
      const existingCategorySnap = await getDocs(categoryQuery);

      if (existingCategorySnap.empty) {
        // Create new category
        const categoryId = Date.now().toString() + '_' + categoryName;
        const categoryRef = doc(db, `Users/${uid}/Category`, categoryId);
        batch.set(categoryRef, {
          id: categoryId,
          name: categoryName,
          description: `Auto-generated category for ${categoryName}`,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          synced: true,
          uid,
        });
        console.log(`Queued creation of category: ${categoryName}`);
      } else {
        // Update existing category timestamp
        const existingCategory = existingCategorySnap.docs[0];
        batch.update(existingCategory.ref, {
          updatedAt: Timestamp.now(),
          synced: true,
        });
        console.log(`Queued update of category: ${categoryName}`);
      }
    }

    await batch.commit();
    console.log('Category synchronization completed.');
  } catch (error) {
    console.error('Error synchronizing Categories:', error);
    throw error;
  }
}

export async function getCategories(): Promise<Category[]> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get categories operation');
  }

  try {
    const snapshot = await getDocs(collection(db, `Users/${uid}/Category`));
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        synced: data.synced,
        syncTimestamp: data.syncTimestamp,
        uid: data.uid,
      } as Category;
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
}

export async function addOrUpdateCategory(
  name: string,
  description?: string,
  id?: string
): Promise<string> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for add/update category operation');
  }

  try {
    const categoryId = id || Date.now().toString() + '_' + name;
    const categoryRef = doc(db, `Users/${uid}/Category`, categoryId);

    const categoryData = {
      id: categoryId,
      name,
      description: description || `Category: ${name}`,
      updatedAt: Timestamp.now(),
      synced: true,
      uid,
    };

    const existingCategory = await getDoc(categoryRef);
    if (existingCategory.exists()) {
      await updateDoc(categoryRef, categoryData);
    } else {
      await setDoc(categoryRef, {
        ...categoryData,
        createdAt: Timestamp.now(),
      });
    }

    console.log(`Category ${id ? 'updated' : 'added'}: ${categoryId}`);
    return categoryId;
  } catch (error) {
    console.error('Error adding/updating category:', error);
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for delete category operation');
  }

  try {
    const categoryRef = doc(db, `Users/${uid}/Category`, id);
    const categorySnap = await getDoc(categoryRef);

    if (categorySnap.exists()) {
      const categoryData = categorySnap.data();
      if (categoryData.uid === uid) {
        await deleteDoc(categoryRef);
        console.log(`Category with ID ${id} deleted.`);
      } else {
        console.error(
          `You cannot delete a category that doesn't belong to you.`
        );
      }
    } else {
      console.error(`Category with ID ${id} does not exist.`);
    }
  } catch (error) {
    console.error(`Error deleting category with ID ${id}:`, error);
    throw error;
  }
}

// Helper function to compare versions
function compareVersions(
  currentVersion: string,
  targetVersion: string
): boolean {
  const parseVersion = (version: string) => version.split('.').map(Number);
  const current = parseVersion(currentVersion);
  const target = parseVersion(targetVersion);

  for (let i = 0; i < Math.max(current.length, target.length); i++) {
    const c = current[i] || 0;
    const t = target[i] || 0;
    if (c < t) return true;
    if (c > t) return false;
  }
  return false;
}

//////////////////////////////////////////
// Database functions for Discussion //
//////////////////////////////////////////

export async function getDiscussions(
  lastX?: number,
  discussionId?: string
): Promise<any[]> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get discussions operation');
  }
  try {
    let discussionsQuery = query(
      collection(db, `Users/${uid}/Discussion`),
      where('uid', '==', uid),
      orderBy('timestamp', 'desc')
    );
    if (discussionId) {
      const discussionRef = doc(db, `Users/${uid}/Discussion`, discussionId);
      const discussionSnap = await getDoc(discussionRef);
      if (discussionSnap.exists()) {
        discussionsQuery = query(discussionsQuery, startAfter(discussionSnap));
      } else {
        console.warn(`Discussion ID ${discussionId} not found.`);
      }
    }
    if (lastX !== undefined) {
      discussionsQuery = query(discussionsQuery, limit(lastX));
    }
    const discussionSnapshot = await getDocs(discussionsQuery);
    return discussionSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp
        ? format(new Date(doc.data().timestamp.toDate()), 'M/d/yy \n h:mm a')
        : 'N/A',
    }));
  } catch (error) {
    console.error('Error getting Discussion:', error);
    return [];
  }
}

export async function deleteDiscussion(id: string): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for delete discussion operation');
  }
  try {
    const discussionRef = doc(db, `Users/${uid}/Discussion`, id);
    const discussionSnap = await getDoc(discussionRef);
    if (discussionSnap.exists()) {
      const discussionData = discussionSnap.data();
      if (discussionData.uid === uid) {
        // First, delete all related activity logs
        const activityLogsQuery = query(
          collection(db, `Users/${uid}/ActivityLog`),
          where('discussionId', '==', id)
        );
        const activityLogsSnap = await getDocs(activityLogsQuery);

        console.log(
          `Deleting ${activityLogsSnap.size} related activity logs for discussion ${id}`
        );

        // Delete all related activity logs
        const deletePromises = activityLogsSnap.docs.map((doc) =>
          deleteDoc(doc.ref)
        );
        await Promise.all(deletePromises);

        // Then delete the discussion itself
        await deleteDoc(discussionRef);
        console.log(
          `Discussion with ID ${id} deleted along with its related activity logs.`
        );
      } else {
        console.error(
          `You cannot delete a discussion that doesn't belong to you.`
        );
      }
    } else {
      console.error(`Discussion with ID ${id} does not exist.`);
    }
  } catch (error) {
    console.error(`Error deleting discussion with ID ${id}:`, error);
  }
}

export const fetchInitialDiscussion = async () => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for fetch initial discussion operation');
  }
  try {
    console.log('Fetching initial discussion with UID:', uid);
    const discussionsQuery = query(
      collection(db, `Users/${uid}/Discussion`),
      where('uid', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const discussionSnapshot = await getDocs(discussionsQuery);
    if (!discussionSnapshot.empty) {
      const docSnapshot = discussionSnapshot.docs[0];
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        discussionId: data.discussionId || docSnapshot.id,
        description: data.description,
        timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
        typeSay: data.typeSay || 'ask',
        cleared: data.cleared || false,
      };
    }
    return null;
  } catch (error) {
    console.error('🔥 Error fetching discussion:', error);
    return null;
  }
};

export const getNextOpenDiscussion = async (lastVisibleDoc?: any) => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get next open discussion operation');
  }
  try {
    console.log(`getNextOpenDiscussion: UID=${uid}`);
    let discussionsQuery = query(
      collection(db, `Users/${uid}/Discussion`),
      where('cleared', 'in', [false, null]),
      where('typeSay', '==', 'ask'),
      where('uid', '==', uid),
      limit(1)
    );
    if (lastVisibleDoc) {
      discussionsQuery = query(discussionsQuery, startAfter(lastVisibleDoc));
    }
    const snapshot = await getDocs(discussionsQuery);
    console.log(
      `getNextOpenDiscussion: Found ${snapshot.docs.length} documents`,
      snapshot.docs.map((doc) => doc.data())
    );
    return {
      snapshot,
      hasMore: snapshot.docs.length > 0,
      lastVisibleDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (error) {
    console.error('🔥 Error fetching discussion:', error);
    return { snapshot: null, hasMore: false, lastVisibleDoc: null };
  }
};

export async function processPendingTells(): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for processing pending tells');
  }
  try {
    console.log('Processing pending tell statements...');
    const q = query(
      collection(db, `Users/${uid}/Discussion`),
      where('typeSay', '==', 'tell'),
      where('cleared', 'in', [false, null]),
      where('uid', '==', uid)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log('No pending tell statements to process.');
      return;
    }

    const rules = await getRules();
    console.log('Rules fetched:', rules);

    for (const doc of snapshot.docs) {
      const discussion = doc.data() as Discussion;
      console.log('Processing tell:', discussion.description);

      // Apply rules to determine category
      let category = 'uncategorized';
      for (const rule of rules) {
        if (rule.isRegex) {
          const pattern = new RegExp(rule.pattern, 'i');
          if (pattern.test(discussion.description)) {
            category = rule.category;
            break;
          }
        } else {
          if (
            discussion.description
              .toLowerCase()
              .includes(rule.pattern.toLowerCase())
          ) {
            category = rule.category;
            break;
          }
        }
      }

      // Add to ActivityLog
      const docRef = await addDoc(collection(db, `Users/${uid}/ActivityLog`), {
        id: doc.id,
        discussionId: doc.id,
        description: discussion.description,
        category,
        timestamp: discussion.timestamp || Timestamp.fromDate(new Date()),
        cleared: false,
        uid,
      });
      console.log('Added to ActivityLog:', docRef.id);

      // Mark discussion as cleared
      await updateDoc(doc.ref, { cleared: true });
      console.log('Cleared discussion:', doc.id);
    }
    console.log('Finished processing pending tell statements.');
  } catch (error) {
    console.error('Error processing pending tells:', error);
    if ((error as any).code === 'permission-denied') {
      console.error(
        'Permission denied. Check Firestore security rules for /Discussion and Users/{uid}/ActivityLog.'
      );
    }
    throw error;
  }
}

export async function addQuestionDiscussion(
  question: string,
  discussionId: string
): Promise<string> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for add question discussion operation');
  }
  try {
    console.log(
      `Adding question: ${question} to discussionId: ${discussionId}`
    );
    await addOrUpdateDiscussion(question, 'ask', discussionId);
    console.log(`Successfully added question to discussion`);
    const gpts_names_string =
      '["openAI", "Gemini", "ChatGPT", "Claude", "DeepSeek"]';
    const gpts_names = JSON.parse(gpts_names_string);
    console.log(`GPT names:`, gpts_names);
    const categories = await getDistinctCategories();
    console.log(`Categories:`, categories);
    const response = await sendQuestionForParsing({
      categories,
      gpts_names,
      question,
      discussionId,
    });
    console.log(`Parsed response received:`, response);
    const docRef = await addDoc(collection(db, 'GPTResponses'), {
      timestamp: new Date(),
      discussionId,
      prompt: question,
      response: JSON.stringify(response),
      responseType: 'parsed question',
      cleared: false,
      uid,
    });
    console.log(`Successfully saved GPT response with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Error adding question discussion:', error);
    throw error;
  }
}

export async function processUnclearedGPTResponses() {
  let hasMoreDocuments = true;
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for process uncleared GPT responses operation'
    );
  }
  while (hasMoreDocuments) {
    const q = query(
      collection(db, 'GPTResponses'),
      where('cleared', '==', false),
      where('responseType', '==', 'updateDB'),
      where('uid', '==', uid),
      limit(1)
    );
    const gptQuerySnapshot = await getDocs(q);
    if (gptQuerySnapshot.empty) {
      hasMoreDocuments = false;
      break;
    }
    const docSnapshot = gptQuerySnapshot.docs[0];
    const gptResponseTyped = {
      id: docSnapshot.id,
      discussionId: docSnapshot.data().discussionId,
      response: docSnapshot.data().response,
      timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
      cleared: docSnapshot.data().cleared,
    };
    console.log('Processing GPT Response:', gptResponseTyped.id);
    const responseJson = JSON.parse(gptResponseTyped.response);
    const { category, parsedDescription } = responseJson;
    const { discussionId, timestamp } = gptResponseTyped;
    const activityLogRef = collection(db, `Users/${uid}/ActivityLog`);
    const qq = query(activityLogRef, where('discussionId', '==', discussionId));
    const querySnapshot = await getDocs(qq);
    const activityLog = !querySnapshot.empty ? querySnapshot.docs[0] : null;
    if (activityLog) {
      console.log('Updating existing activity log...');
      const existingActivityLogRef = doc(
        db,
        `Users/${uid}/ActivityLog`,
        activityLog.id
      );
      await updateDoc(existingActivityLogRef, {
        category,
        description: parsedDescription,
        responseType: 'tell',
        cleared: true,
        uid,
      });
    } else {
      console.log('Creating new activity log...');
      await addDoc(collection(db, `Users/${uid}/ActivityLog`), {
        discussionId,
        category,
        description: parsedDescription,
        timestamp: Timestamp.fromDate(timestamp),
        cleared: true,
        uid,
      });
    }
    const gptResponseRef = doc(db, 'GPTResponses', gptResponseTyped.id);
    await updateDoc(gptResponseRef, { cleared: true });
    console.log('Processed and cleared GPTResponse:', gptResponseTyped.id);
    const success = await clearDiscussion(discussionId);
    if (!success) {
      console.error('Failed to clear discussion. Exiting process.');
      return;
    }
  }
  console.log('All GPTResponses have been cleared.');
}

export const markDiscussionAsCleared = async (
  discussionId: string
): Promise<void> => {
  console.log(`Attempting to mark discussion ${discussionId} as cleared...`);
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for mark discussion as cleared operation'
    );
  }
  try {
    const discussionRef = doc(db, `Users/${uid}/Discussion`, discussionId);
    await updateDoc(discussionRef, { cleared: true });
    console.log(`✅ Discussion ${discussionId} marked as cleared.`);
  } catch (error) {
    console.error('🔥 Error marking discussion as cleared:', error);
  }
};

export async function clearDiscussion(discussionId: string): Promise<boolean> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for clear discussion operation');
  }
  try {
    const discussionRef = doc(db, `Users/${uid}/Discussion`, discussionId);
    console.log(`Attempting to clear discussion ${discussionId}...`);
    const docSnapshot = await getDoc(discussionRef);
    if (docSnapshot.exists()) {
      console.log(`Discussion ${discussionId} exists. Updating...`);
      await updateDoc(discussionRef, { cleared: true });
      console.log(`Processed and cleared Discussion: ${discussionId}`);
    } else {
      console.log(`Discussion ${discussionId} not found. Skipping update.`);
    }
    return true;
  } catch (error) {
    console.error(`Error clearing discussion ${discussionId}:`, error);
    return false;
  }
}

export async function addOrUpdateActivityLog(): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for add or update activity log operation'
    );
  }
  try {
    interface GPTResponseJSONData {
      category: string;
      parsedDescription: string;
    }
    const q = query(
      collection(db, 'GPTResponses'),
      where('cleared', '==', false),
      where('responseType', '==', 'updateDB'),
      where('uid', '==', uid)
    );
    const gptQuerySnapshot = await getDocs(q);
    for (const docSnapshot of gptQuerySnapshot.docs) {
      const gptResponseTyped = {
        id: docSnapshot.id,
        discussionId: docSnapshot.data().discussionId,
        response: docSnapshot.data().response,
        timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
        cleared: docSnapshot.data().cleared,
        uid,
      };
      console.log('Raw GPT response JSON:', gptResponseTyped.response);
      const responseJson = JSON.parse(
        gptResponseTyped.response
      ) as GPTResponseJSONData;
      console.log('Parsed category:', responseJson.category);
      console.log('Parsed description:', responseJson.parsedDescription);
      const category = responseJson.category;
      const parsedDescription = responseJson.parsedDescription;
      const discussionId = gptResponseTyped.discussionId;
      const timestamp = gptResponseTyped.timestamp;
      const activityLogRef = collection(db, `Users/${uid}/ActivityLog`);
      const qq = query(
        activityLogRef,
        where('discussionId', '==', discussionId)
      );
      const querySnapshot = await getDocs(qq);
      const activityLog = !querySnapshot.empty
        ? querySnapshot.docs[0].data()
        : null;
      if (activityLog) {
        console.log('Updating existing response...');
        const existingActivityLogRef = doc(
          db,
          `Users/${uid}/ActivityLog`,
          querySnapshot.docs[0].id
        );
        await updateDoc(existingActivityLogRef, {
          category: category,
          description: parsedDescription,
          responseType: 'tell',
          cleared: true,
          uid,
        });
      } else {
        console.log(
          'No existing activity log found. Creating new activity log...'
        );
        await addDoc(collection(db, `Users/${uid}/ActivityLog`), {
          id: new Date().getTime().toString(),
          discussionId,
          category,
          description: parsedDescription,
          timestamp: Timestamp.fromDate(timestamp),
          cleared: true,
          uid,
        });
        console.log('New response created.');
      }
      const gptResponseRef = doc(db, 'GPTResponses', gptResponseTyped.id);
      await updateDoc(gptResponseRef, { cleared: true });
    }
  } catch (error) {
    console.error('Error adding or updating GPT response:', error);
  }
}

export const renameFieldToCleared = async () => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for rename field to cleared operation');
  }
  try {
    const discussionCollection = collection(db, `Users/${uid}/Discussion`);
    const querySnapshot = await getDocs(discussionCollection);
    querySnapshot.forEach(async (document) => {
      const docRef = doc(db, `Users/${uid}/Discussion`, document.id);
      const data = document.data();
      const fieldName = Object.keys(data).find(
        (key) => key.toLowerCase() === 'cleared'
      );
      if (fieldName && fieldName !== 'cleared') {
        await updateDoc(docRef, {
          cleared: data[fieldName],
          [fieldName]: deleteField(),
          uid,
        });
        console.log(`Updated document ${document.id}`);
      }
    });
    console.log('All documents updated successfully!');
  } catch (error) {
    console.error('Error updating documents: ', error);
  }
};

interface LastOpenDiscussion {
  id: string;
  description: string;
}

export async function getLastOpenDiscussion(): Promise<LastOpenDiscussion> {
  const currentTime = new Date();
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get last open discussion operation');
  }
  try {
    const querySnapshot = await getDocs(
      collection(db, `Users/${uid}/Discussion`)
    );
    const discussions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as {
        timestamp: Timestamp;
        description: string;
        cleared: boolean;
      }),
    }));
    const lastOpenDiscussion = discussions
      .filter(
        (discussion) =>
          !discussion.cleared &&
          discussion.description !== '' &&
          discussion.description !== null
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp.toDate()).getTime() -
          new Date(a.timestamp.toDate()).getTime()
      )[0];
    console.log('Last open discussion:', lastOpenDiscussion?.description);
    return {
      id: lastOpenDiscussion.id,
      description: lastOpenDiscussion.description,
    };
  } catch (error) {
    console.error('Error getting last open discussion:', error);
    return Promise.reject(error);
  }
}

async function waitForDocument(
  ref: DocumentReference<unknown, DocumentData>,
  timeout = 5000
) {
  return new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(
      ref,
      (docSnap) => {
        if (docSnap.exists()) {
          unsubscribe();
          resolve(docSnap);
        }
      },
      (error: any) => {
        unsubscribe();
        reject(error);
      }
    );
    setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          'Document did not become available within the specified timeout.'
        )
      );
    }, timeout);
  });
}

export async function disperseQuestion(
  discussionId: string,
  GPT_ResponseId: string
): Promise<string[] | undefined> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for disperse question operation');
  }
  try {
    console.log('Attempting to disperse question and get answers...');
    const discussionRef = doc(db, `Users/${uid}/Discussion`, discussionId);
    const discussionDoc = await getDoc(discussionRef);
    if (!discussionDoc.exists()) {
      console.log(`No discussion found with ID: ${discussionId}`);
      return;
    }
    const gptResponseRef = doc(db, 'GPTResponses', GPT_ResponseId);
    console.log('Waiting for GPT Response to be ready...');
    const gptResponseDoc = await waitForDocument(gptResponseRef);
    console.log('GPT Response is ready.');
    if (!gptResponseDoc) {
      console.error('GPT Response not found');
      return undefined;
    }
    console.log(
      'GPT Response found:',
      JSON.parse((gptResponseDoc as DocumentSnapshot).get('response'))
    );
    const parsedQuestion = JSON.parse(
      (gptResponseDoc as DocumentSnapshot).get('response')
    );
    let responses: string[] = [];
    for (const part of parsedQuestion.parts) {
      const { gpt, category, parsedDescription: question } = part;
      console.log(
        `Sending question to GPT ${gpt} for category(s) ${category}:`,
        question
      );
      const response = await sendQuestion({
        category,
        gpt,
        question,
        discussionId,
      });
      console.log(
        `Got response from GPT ${gpt} for category(s) ${category}:`,
        response
      );
      await addDoc(collection(db, 'GPTResponses'), {
        timestamp: new Date(),
        prompt: question,
        response: response,
        responseType: 'gpt response',
        discussionId,
        cleared: false,
        uid,
      });
      responses.push(response.parsedDescription);
    }
    return responses;
  } catch (error) {
    console.error('Error dispersing question:', error);
    return undefined;
  }
}

export async function disperseQuestionOLD(
  discussionId: string,
  GPT_ResponseId: string
): Promise<string[] | undefined> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for disperse question old operation');
  }
  try {
    const discussionRef = doc(db, `Users/${uid}/Discussion`, discussionId);
    const discussionDoc = await getDoc(discussionRef);
    if (discussionDoc.exists()) {
      const gptResponseRef = doc(db, 'GPTResponses', GPT_ResponseId);
      const gptResponseDoc = await getDoc(gptResponseRef);
      if (gptResponseDoc.exists()) {
        const parsedQuestion = JSON.parse(
          gptResponseDoc.data()!.response as string
        );
        let responses: string[] = [];
        for (const part of parsedQuestion.parts) {
          const gpt = part.gpt;
          const category = part.category;
          const question = part.parsedDescription;
          console.log(
            `Sending question to GPT ${gpt} for category ${category}:`,
            question
          );
          const response = await sendQuestion({
            category,
            gpt,
            question,
            discussionId,
          });
          console.log(
            `Got response from GPT ${gpt} for category ${category}:`,
            response
          );
          await addDoc(collection(db, 'GPTResponses'), {
            id: new Date().getTime().toString(),
            timestamp: new Date(),
            prompt: question,
            response: response,
            responseType: 'gpt response',
            discussionId: discussionId,
            cleared: false,
            uid,
          });
          responses.push(response.parsedDescription);
        }
        return responses;
      } else {
        console.error('GPT Response not found');
      }
    } else {
      console.log(`No discussion found with ID: ${discussionId}`);
    }
  } catch (error) {
    console.error('Error dispersing question:', error);
  }
  return undefined;
}

//////////////////////////////////////////
// Database functions for GPT Responses //
//////////////////////////////////////////

export async function addOrUpdateGPTResponse(
  discussionId: string,
  response: string,
  responseType: string,
  cleared: boolean = false
): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for add or update GPT response operation'
    );
  }
  try {
    const docRef = doc(collection(db, 'GPTResponses'), String(Date.now()));
    await setDoc(docRef, {
      discussionId,
      response,
      responseType,
      timestamp: new Date(),
      cleared,
      uid,
    });
    console.log('GPT Response saved.');
  } catch (error) {
    console.error('Error adding/updating GPT response:', error);
  }
}

export async function getGPTResponses(discussionId: string): Promise<any[]> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get GPT responses operation');
  }
  try {
    const q = query(
      collection(db, 'GPTResponses'),
      where('discussionId', '==', discussionId),
      where('uid', '==', uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: { data: () => any }) => doc.data());
  } catch (error) {
    console.error('Error getting GPT responses:', error);
    return [];
  }
}

export async function getParsedGPTResponses(
  discussionId: string
): Promise<string[]> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get parsed GPT responses operation');
  }
  try {
    const parsedResponses: string[] = [];
    let lastVisible: any = null;
    const batchSize = 10;
    do {
      let q = query(
        collection(db, 'GPTResponses'),
        where('discussionId', '==', discussionId),
        where('responseType', '==', 'parsed answer'),
        where('uid', '==', uid),
        limit(batchSize)
      );
      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.responseType === 'parsed answer') {
            parsedResponses.push(data.response);
          }
        });
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
      } else {
        lastVisible = null;
      }
    } while (lastVisible);
    return parsedResponses;
  } catch (error) {
    console.error('Error getting parsed GPT responses:', error);
    return [];
  }
}

export async function getAIResponse(question: string): Promise<string> {
  return new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve(`This is an AI-generated response to: "${question}"`);
    }, 2000);
  });
}

// --- Changelog and legacy sync helpers ---

/**
 * Create a changelog entry in Firestore and return the new entry.
 * All Realm writes must be handled by the local/router layer.
 * @param tableName The table affected (e.g., 'ActivityLog')
 * @param rowId The row/document ID affected
 * @param operation 'create' | 'update' | 'delete'
 * @returns Promise<ChangeLogEntry>
 */
export async function createAndSyncChangelogEntry(
  tableName: string,
  rowId: string,
  operation: 'create' | 'update' | 'delete',
  timestamp?: Date
): Promise<any> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for changelog operation');
  const ts = timestamp || new Date();
  const changelogEntry = {
    id: `${tableName}_${rowId}_${ts.getTime()}`,
    tableName,
    rowId,
    operation,
    timestamp: ts,
    uid,
  };
  await setDoc(
    doc(db, `Users/${uid}/ChangeLog`, changelogEntry.id),
    changelogEntry
  );
  console.log('Created changelog entry in Firestore:', changelogEntry);
  return changelogEntry;
}

/**
 * Download all new Firestore rows for a table that are not represented in the local changelog (rowIds),
 * and return both the new rows and the changelog entries that should be created for them.
 * All Realm writes must be handled by the local/router layer.
 *
 * @param tableName The Firestore collection/table name (e.g., 'ActivityLog')
 * @param localChangeLogRowIds Set of rowIds already present in the local changelog
 * @returns Promise<{ newRows: any[], changelogEntries: any[] }>
 */
export async function downloadNewRowsAndSyncChangelog(
  tableName: string,
  localChangeLogRowIds: Set<string>
): Promise<{ newRows: any[]; changelogEntries: any[] }> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for download/sync operation');
  // 1. Get all remote rows from Firestore
  const remoteSnap = await getDocs(collection(db, `Users/${uid}/${tableName}`));
  const remoteRows = remoteSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  // 2. Filter remote rows not in local changelog
  const newRows = remoteRows.filter(
    (row) => !localChangeLogRowIds.has(row.id.toString())
  );
  if (newRows.length === 0) {
    console.log('No new remote rows to process.');
    return { newRows: [], changelogEntries: [] };
  }
  // 3. For each new row, create changelog entry in Firestore and collect for local/router
  const changelogEntries: any[] = [];
  for (const row of newRows) {
    let timestamp: Date = new Date();
    if (
      'syncTimestamp' in row &&
      row.syncTimestamp &&
      typeof row.syncTimestamp !== 'object' &&
      row.syncTimestamp !== undefined
    ) {
      timestamp = new Date(String(row.syncTimestamp));
    } else if (
      'timestamp' in row &&
      row.timestamp &&
      typeof row.timestamp !== 'object' &&
      row.timestamp !== undefined
    ) {
      timestamp = new Date(String(row.timestamp));
    }
    const changelogId = `${tableName}_${row.id}_${timestamp.getTime()}`;
    const changelogEntry = {
      id: changelogId,
      tableName,
      rowId: row.id,
      operation: 'create',
      timestamp,
      uid,
    };
    await setDoc(
      doc(db, `Users/${uid}/ChangeLog`, changelogId),
      changelogEntry
    );
    changelogEntries.push(changelogEntry);
  }
  console.log(`Processed ${newRows.length} new remote rows for changelog.`);
  return { newRows, changelogEntries };
}

/**
 * Download all Firestore rows for a table that are not represented in EITHER the local changelog OR the Firestore changelog,
 * and return both the new rows and the changelog entries that should be created for them.
 * All Realm writes must be handled by the local/router layer.
 *
 * @param tableName The Firestore collection/table name (e.g., 'ActivityLog')
 * @param localChangeLogRowIds Set of rowIds already present in the local changelog
 * @returns Promise<{ newRows: any[], changelogEntries: any[] }>
 */
export async function downloadLegacyRowsAndSyncChangelog(
  tableName: string,
  localChangeLogRowIds: Set<string>,
  localChangeLogTimestamps?: Map<string, Date>
): Promise<{ newRows: any[]; changelogEntries: any[] }> {
  console.log(`Downloading legacy rows for table: ${tableName}`);
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for download/sync operation');
  // 1. Get all remote rows from Firestore
  const remoteSnap = await getDocs(collection(db, `Users/${uid}/${tableName}`));
  const remoteRows = remoteSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  // 2. Get all Firestore changelog rowIds and timestamps for this table
  const remoteChangeLogSnap = await getDocs(
    collection(db, `Users/${uid}/ChangeLog`)
  );
  const remoteChangeLogMap = new Map<string, Date>();
  remoteChangeLogSnap.docs.forEach((doc) => {
    const cl = doc.data();
    if (cl.tableName === tableName && cl.rowId) {
      remoteChangeLogMap.set(cl.rowId.toString(), new Date(cl.timestamp));
    }
  });
  // Optionally accept localChangeLogTimestamps for more robust comparison
  const localChangeLogMap = localChangeLogTimestamps || new Map<string, Date>();
  // 3. Build set of all rowIds in local changelog
  const localRowIds = localChangeLogRowIds;
  // 4. For each remote row, apply union logic
  const legacyRows: any[] = [];
  for (const row of remoteRows) {
    const rowId = row.id?.toString?.();
    const remoteTS = remoteChangeLogMap.get(rowId);
    const localTS = localChangeLogMap.get(rowId);
    if (!remoteTS && !localTS) {
      // (B) No changelog entry in either place
      legacyRows.push(row);
    } else if (remoteTS && !localTS) {
      // Remote changelog exists, local missing
      legacyRows.push(row);
    } else if (remoteTS && localTS && remoteTS > localTS) {
      // Both exist, remote newer
      legacyRows.push(row);
    }
    // else: skip (local is newer or equal)
  }
  // Convert Firestore Timestamp fields to JS Date for all legacyRows
  const legacyRowsWithDates = legacyRows.map((row) => {
    ensureDateField(row, 'timestamp');
    ensureDateField(row, 'syncTimestamp');
    return row;
  });
  // 5. For each legacy row, create a remote changelog entry if missing
  const changelogEntries: any[] = [];
  for (const row of legacyRowsWithDates) {
    const rowId = row.id?.toString?.();
    let timestamp: Date = new Date();
    if (
      'syncTimestamp' in row &&
      row.syncTimestamp &&
      typeof row.syncTimestamp !== 'object' &&
      row.syncTimestamp !== undefined
    ) {
      timestamp = new Date(String(row.syncTimestamp));
    } else if (
      'timestamp' in row &&
      row.timestamp &&
      typeof row.timestamp !== 'object' &&
      row.timestamp !== undefined
    ) {
      timestamp = new Date(String(row.timestamp));
    }
    if (!remoteChangeLogMap.has(rowId)) {
      const changelogId = `${tableName}_${rowId}_${timestamp.getTime()}`;
      const changelogEntry = {
        id: changelogId,
        tableName,
        rowId,
        operation: 'create',
        timestamp,
        uid,
      };
      await setDoc(
        doc(db, `Users/${uid}/ChangeLog`, changelogId),
        changelogEntry
      );
      changelogEntries.push(changelogEntry);
    }
  }
  if (legacyRowsWithDates.length === 0) {
    console.log(
      'No legacy/unsynced remote rows to process for table: ' + tableName + '.'
    );
    return { newRows: [], changelogEntries: [] };
  }
  console.log(
    `Processed ${legacyRowsWithDates.length} legacy/unsynced remote rows for changelog for table ${tableName} .`
  );
  return { newRows: legacyRowsWithDates, changelogEntries };
}

// Sync unsynced Realm rows to Firestore
export async function syncRealmRowsToFirestore(
  tableName: string,
  realmRows: any[]
): Promise<string[]> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for sync operation');
  const syncedIds: string[] = [];
  for (const row of realmRows) {
    try {
      const docId = row.id?.toString() || new Date().getTime().toString();

      // Clean the row data to remove Realm-specific fields that Firestore can't handle
      const cleanRow = { ...row };
      delete cleanRow.activityLogs; // Remove Realm List object

      await setDoc(
        doc(db, `Users/${uid}/${tableName}`, docId),
        { ...cleanRow, uid, synced: true, syncTimestamp: new Date() },
        { merge: true }
      );
      syncedIds.push(docId);
      console.log(`Synced Realm row to Firestore: ${docId}`);
    } catch (error) {
      console.error('Error syncing row to Firestore:', error, row);
    }
  }
  return syncedIds;
}

//////////////////////////////////////////
// Database functions for Alerts //
//////////////////////////////////////////

export async function getNextActiveAlert(): Promise<any | null> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get next active alert operation');
  }
  try {
    const q = query(
      collection(db, 'Alert'),
      where('isActive', '==', true),
      where('uid', '==', uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.length ? snapshot.docs[0].data() : null;
  } catch (error) {
    console.error('Error fetching active alert:', error);
    return null;
  }
}

export async function addOrUpdateAlert(alertData: any): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for add or update alert operation');
  }
  try {
    const docRef = alertData._id
      ? doc(db, 'Alert', alertData._id)
      : doc(collection(db, 'Alert'));
    await setDoc(
      docRef,
      { ...alertData, createdAt: new Date(), uid },
      { merge: true }
    );
    console.log(`Alert ${alertData._id ? 'updated' : 'added'} successfully.`);
  } catch (error) {
    console.error('Error adding/updating alert:', error);
  }
}

//////////////////////////////////////////
// Database functions for GPT Specialties //
//////////////////////////////////////////

export async function getURLofGPT(
  gpt_name: string
): Promise<{ url: string; apiKey: string } | null> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get URL of GPT operation');
  }
  try {
    const q = query(
      collection(db, 'GPTSpecialties'),
      where('name', '==', gpt_name)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.length
      ? (snapshot.docs[0].data() as { url: string; apiKey: string })
      : null;
  } catch (error) {
    console.error('Error fetching GPT specialty:', error);
    return null;
  }
}

export async function expandFromAbbreviation(
  discussion: string
): Promise<string> {
  console.log(`Attempting to expand abbreviation '${discussion}'`);
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for expand abbreviation operation');
  }
  const abbreviationMap = new Map<string, string>([
    ['1', 'i urinated'],
    ['11', 'i had a high volume of urination'],
    ['2', 'i had a regular size poop'],
    ['22', 'i had a large poop'],
  ]);
  const expandedForm = abbreviationMap.get(discussion);
  console.log(`Expanded '${discussion}' to '${expandedForm}'`);
  if (expandedForm) {
    return Promise.resolve(expandedForm);
  }
  return Promise.resolve(discussion);
}

export async function getRules(): Promise<
  Array<{ pattern: string; category: string; isRegex: boolean }>
> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for getRules');
  try {
    const rulesSnapshot = await getDocs(collection(db, `Users/${uid}/Rules`));
    return rulesSnapshot.docs.map((doc) => ({
      pattern: doc.data().pattern,
      category: doc.data().category,
      isRegex: doc.data().isRegex || false,
    }));
  } catch (error) {
    console.error('Error fetching rules:', error);
    return [];
  }
}

// Restore lost data to ActivityLog collection
export async function restoreLostData(): Promise<void> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for restore lost data operation');
  const lostData = [
    {
      id: '1738367528606',
      typeSay: 'tell',
      timestamp: 1738367528606,
      description: '1',
    },
    {
      id: '1738374105437',
      typeSay: 'tell',
      timestamp: 1738374105437,
      description: 'I ate salmon couscous and 2 slices of avocado',
    },
    {
      id: '1738382525048',
      typeSay: 'tell',
      timestamp: 1738382525048,
      description: 'Took 5 mg Staten',
    },
    {
      id: '7vukcCfVaBApZaAv6PoU',
      typeSay: 'tell',
      timestamp: 1738374105437,
      description: "I'm feeling anxious and frustrated",
    },
    {
      id: '92JlMF1EHheU8uPMLBMi',
      typeSay: 'tell',
      timestamp: 1738382525048,
      description: '1',
    },
    {
      id: 'ArZ5Z0pQN1RKVb3kWuVh',
      typeSay: 'tell',
      timestamp: 1738374105437,
      description:
        'Ate Cheese omelet 3 out of 4 yolks removed with mustard leaf onions',
    },
    {
      id: 'BA5UcSPVyWjPUHCMNiwM',
      typeSay: 'tell',
      timestamp: 1738382525048,
      description: 'I ate banana',
    },
  ];
  for (const entry of lostData) {
    try {
      const docRef = doc(collection(db, `Users/${uid}/ActivityLog`), entry.id);
      await setDoc(docRef, {
        typeSay: entry.typeSay,
        description: entry.description,
        timestamp: Timestamp.fromMillis(entry.timestamp),
        uid: uid,
        cleared: false,
        category: 'uncategorized',
      });
      console.log(`Restored document: ${entry.id}`);
    } catch (error) {
      console.error(`Failed to restore document ${entry.id}:`, error);
    }
  }
  console.log('Data restoration completed!');
}

// Delete ActivityLog by id
export async function deleteActivityLog(activityLogId: string): Promise<void> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for delete operation');

  try {
    // First, get the activity log to find its discussionId
    const activityLogRef = doc(db, `Users/${uid}/ActivityLog`, activityLogId);
    const activityLogSnap = await getDoc(activityLogRef);

    if (activityLogSnap.exists()) {
      const activityLogData = activityLogSnap.data();
      const discussionId = activityLogData.discussionId;

      // Delete the activity log
      await deleteDoc(activityLogRef);
      console.log(`ActivityLog with ID ${activityLogId} deleted.`);

      // Set the parent discussion's cleared status to false
      if (discussionId) {
        const discussionRef = doc(db, `Users/${uid}/Discussion`, discussionId);
        await updateDoc(discussionRef, {
          cleared: false,
        });
        console.log(
          `Discussion ${discussionId} cleared status set to false due to activity log deletion.`
        );
      }
    } else {
      console.error(`ActivityLog with ID ${activityLogId} not found.`);
    }
  } catch (error) {
    console.error(
      `Error deleting activity log with ID ${activityLogId}:`,
      error
    );
    throw error;
  }
}

// Create ActivityLog
export async function createActivityLog(
  activityLog: Omit<ActivityLog, 'id'>
): Promise<string> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for createActivityLog');
  const docRef = await addDoc(collection(db, `Users/${uid}/ActivityLog`), {
    ...activityLog,
    uid,
    timestamp: activityLog.timestamp
      ? Timestamp.fromDate(new Date(activityLog.timestamp))
      : new Date(),
    cleared: activityLog.cleared ?? false,
    lockedCategory: activityLog.lockedCategory ?? false,
    lockedDescription: activityLog.lockedDescription ?? false,
  });
  console.log('ActivityLog created with ID:', docRef.id);
  return docRef.id;
}

// Update ActivityLog category
export async function updateActivityLogCategory(
  activityLogId: string,
  category: string
): Promise<void> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for updateActivityLogCategory');
  const docRef = doc(db, `Users/${uid}/ActivityLog`, activityLogId);
  await updateDoc(docRef, { category, lockedCategory: true });
  console.log(`ActivityLog ${activityLogId} category updated to ${category}`);
}

// Create RuleCandidate
export async function createRuleCandidate(data: {
  discussionId: string;
  category: string;
  description: string;
  uid: string;
}): Promise<void> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for createRuleCandidate');
  await addDoc(collection(db, `Users/${uid}/RuleCandidates`), {
    ...data,
    timestamp: new Date(),
  });
  console.log('RuleCandidate created:', data);
}

// --- SYNC HELPERS: Timestamp-based update/delete for robust sync ---

/**
 * Update a Firestore row only if the incoming syncTimestamp is newer than the existing one.
 * @param tableName Firestore collection name (e.g., 'ActivityLog')
 * @param rowId Document ID
 * @param data Data to update (must include syncTimestamp)
 * @returns true if updated, false if skipped (older)
 */
export async function updateRowIfNewer(
  tableName: string,
  rowId: string,
  data: any
): Promise<boolean> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  const docRef = doc(db, `Users/${uid}/${tableName}`, rowId);
  const docSnap = await getDoc(docRef);
  const incomingTS = new Date(data.syncTimestamp).getTime();
  if (docSnap.exists()) {
    const existingTS = docSnap.data().syncTimestamp
      ? new Date(docSnap.data().syncTimestamp).getTime()
      : 0;
    if (incomingTS <= existingTS) {
      console.log(`Skipped update for ${rowId}: incoming older or same.`);
      return false;
    }
  }
  await setDoc(docRef, data, { merge: true });
  console.log(`Updated row ${rowId} in ${tableName}`);
  return true;
}

/**
 * Mark a Firestore row as deleted only if the incoming syncTimestamp is newer than the existing one.
 * @param tableName Firestore collection name
 * @param rowId Document ID
 * @param deletedAt Timestamp of deletion
 * @returns true if deleted, false if skipped (older)
 */
export async function deleteRowIfNewer(
  tableName: string,
  rowId: string,
  deletedAt: Date
): Promise<boolean> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  const docRef = doc(db, `Users/${uid}/${tableName}`, rowId);
  const docSnap = await getDoc(docRef);
  const incomingTS = deletedAt.getTime();
  if (docSnap.exists()) {
    const existingTS = docSnap.data().syncTimestamp
      ? new Date(docSnap.data().syncTimestamp).getTime()
      : 0;
    if (incomingTS <= existingTS) {
      console.log(`Skipped delete for ${rowId}: incoming older or same.`);
      return false;
    }
  }
  await setDoc(
    docRef,
    { deleted: true, deletedAt, syncTimestamp: deletedAt },
    { merge: true }
  );
  console.log(`Marked row ${rowId} as deleted in ${tableName}`);
  return true;
}

/**
 * Fetches all remote Firestore rows for a table updated after a given timestamp.
 * @param tableName The Firestore collection/table name (e.g., 'ActivityLog')
 * @param lastSyncTimestamp Only fetch rows with syncTimestamp or timestamp > this value
 * @returns Promise<{ rows: any[] }>
 */
export async function fetchTableUpdates(
  tableName: string,
  lastSyncTimestamp: Date
): Promise<{ rows: any[] }> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  const collectionRef = collection(db, `Users/${uid}/${tableName}`);
  // Try to use syncTimestamp if present, else fallback to timestamp
  const q = query(
    collectionRef,
    where('syncTimestamp', '>', lastSyncTimestamp)
  );
  const snapshot = await getDocs(q);
  const rows = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  // Fallback: If no rows and syncTimestamp is missing, try timestamp
  if (rows.length === 0) {
    const q2 = query(collectionRef, where('timestamp', '>', lastSyncTimestamp));
    const snapshot2 = await getDocs(q2);
    return {
      rows: snapshot2.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
  }
  return { rows };
}

// Helper: convert Firestore Timestamp to JS Date if needed
function ensureDateField(obj: any, field: string) {
  if (obj[field]) {
    // Firestore Timestamp object: { seconds, nanoseconds }
    if (
      typeof obj[field] === 'object' &&
      obj[field] !== null &&
      typeof obj[field].seconds === 'number' &&
      typeof obj[field].nanoseconds === 'number'
    ) {
      obj[field] = new Date(
        obj[field].seconds * 1000 + Math.floor(obj[field].nanoseconds / 1e6)
      );
    } else if (typeof obj[field].toDate === 'function') {
      obj[field] = obj[field].toDate();
    } else if (
      typeof obj[field] === 'number' ||
      typeof obj[field] === 'string'
    ) {
      obj[field] = new Date(obj[field]);
    }
  }
}

/**
 * Extract unique records from root-level Firestore 'Discussion' and 'ActivityLog', deduplicate by timestamp,
 * insert into both Realm and user-level Firestore, and create changelog entries with correct historical timestamps.
 * No deletion of Firebase records. For 'Discussion', can be run continuously; for 'ActivityLog', one-time.
 */
export async function extractAndImportLegacyFirestoreData({
  continuous = false,
}: { continuous?: boolean } = {}) {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  if (!realm) throw new Error('Realm not initialized');

  // Helper: deduplicate by timestamp
  function deduplicateByTimestamp<T extends { timestamp?: any }>(
    rows: T[]
  ): T[] {
    const seen = new Set<number>();
    return rows.filter((row) => {
      let ts: number = 0;
      if (row.timestamp?.toMillis) ts = row.timestamp.toMillis();
      else if (row.timestamp instanceof Date) ts = row.timestamp.getTime();
      else if (typeof row.timestamp === 'number') ts = row.timestamp;
      else if (typeof row.timestamp === 'string')
        ts = new Date(row.timestamp).getTime();
      if (seen.has(ts)) return false;
      seen.add(ts);
      return true;
    });
  }

  // Helper: upsert to user-level Firestore
  async function upsertToUserFirestore(tableName: string, row: any) {
    const userDocRef = doc(db, `Users/${uid}/${tableName}`, row.id);

    // Remove Realm-specific fields that Firestore can't handle
    const cleanRow = { ...row };
    delete cleanRow.activityLogs; // Remove Realm List object

    await setDoc(userDocRef, { ...cleanRow, uid }, { merge: true });
  }

  // Helper: upsert to Realm
  function upsertToRealm(tableName: string, row: any) {
    try {
      realm!.write(() => {
        realm!.create(tableName, { ...row }, Realm.UpdateMode.Modified);
      });
    } catch (error: any) {
      console.error(`[upsertToRealm] Error inserting ${tableName} row:`, {
        error: error?.message || String(error),
        rowId: row.id,
        rowData: JSON.stringify(row, null, 2),
      });
      throw error;
    }
  }

  // Helper: create changelog entry (local and remote)
  async function createChangelog(tableName: string, row: any) {
    const ts = row.syncTimestamp
      ? new Date(row.syncTimestamp)
      : row.timestamp
      ? new Date(row.timestamp)
      : undefined;
    if (!ts) {
      console.warn(
        `[createChangelog] Row with id ${row.id} missing valid timestamp, skipping changelog entry.`
      );
      return;
    }
    // Ensure row.id is a string for both functions
    const rowIdString = String(row.id);
    addChangeLogEntry(tableName, rowIdString, 'create', ts);
    await createAndSyncChangelogEntry(tableName, rowIdString, 'create', ts);
  }

  // Main extraction logic for a table
  async function extractTable<
    T extends {
      id: string;
      timestamp?: any;
      discussionId?: string;
      discussionID?: string;
      synced?: boolean;
      cleared?: boolean;
      typeSay?: string;
    }
  >(tableName: string, rootCollection: string) {
    const snap = await getDocs(collection(db, rootCollection));
    let rows: T[] = snap.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as T)
    );
    rows = deduplicateByTimestamp(rows);
    for (const row of rows) {
      // Ensure discussionId is always set for Realm schema
      if (tableName === 'Discussion') {
        // Ensure all required fields are strings and present
        row.discussionId = String(row.discussionId || row.id);
        row.synced = typeof row.synced === 'boolean' ? row.synced : false;
        row.cleared = typeof row.cleared === 'boolean' ? row.cleared : false;
        (row as any).typeSay = String((row as any).typeSay || 'tell');
        // Ensure description is a string
        (row as any).description = String((row as any).description || '');
      } else if (tableName === 'ActivityLog') {
        // Ensure all required fields are strings and present
        row.discussionId = String(
          row.discussionId || row.discussionID || row.id
        );
        row.synced = typeof row.synced === 'boolean' ? row.synced : false;
        row.cleared = typeof row.cleared === 'boolean' ? row.cleared : false;
        (row as any).responseType = String((row as any).responseType || 'tell');
        // Ensure category and description are strings
        (row as any).category = String((row as any).category || 'general');
        (row as any).description = String((row as any).description || '');
      }

      // Ensure id is always a string
      row.id = String(row.id);
      // Convert Firestore Timestamp to JS Date ONLY if needed, but NEVER use current date as fallback
      if (row.timestamp && typeof row.timestamp.toDate === 'function') {
        row.timestamp = row.timestamp.toDate();
      } else if (
        row.timestamp &&
        typeof row.timestamp === 'object' &&
        row.timestamp.seconds
      ) {
        row.timestamp = new Date(row.timestamp.seconds * 1000);
      } else if (
        typeof row.timestamp === 'string' ||
        typeof row.timestamp === 'number'
      ) {
        row.timestamp = new Date(row.timestamp);
      } else {
        // If timestamp is missing or invalid, do NOT use current date; instead, skip or log error
        console.warn(
          `[extractTable] Row with id ${row.id} is missing a valid timestamp. Skipping.`
        );
        continue;
      }
      // Upsert to Realm
      upsertToRealm(tableName, row);
      // Upsert to user-level Firestore
      await upsertToUserFirestore(tableName, row);
      // Create changelog entry
      await createChangelog(tableName, row);
    }
    return rows.length;
  }

  // Extract from root-level 'Discussion' and 'ActivityLog'
  const discussionCount = await extractTable('Discussion', 'Discussion');
  const activityLogCount = await extractTable('ActivityLog', 'ActivityLog');

  // If continuous, set up a timer for 'Discussion' (not implemented here, just call this periodically)
  if (continuous) {
    // setTimeout(() => extractAndImportLegacyFirestoreData({ continuous: true }), 5 * 60 * 1000);
    // Or use a scheduler in your app
  }

  console.log(
    `Imported ${discussionCount} unique Discussion and ${activityLogCount} unique ActivityLog records from root-level Firestore.`
  );
  return { discussionCount, activityLogCount };
}

/**
 * Delete all rows in the remote (Firebase) ChangeLog collection for the current user
 */
export async function deleteAllRemoteChangeLogs() {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  const changeLogCollection = collection(db, `Users/${uid}/ChangeLog`);
  const snapshot = await getDocs(changeLogCollection);
  let count = 0;
  for (const docSnap of snapshot.docs) {
    await deleteDoc(docSnap.ref);
    count++;
  }
  console.log(
    `[deleteAllRemoteChangeLogs] Deleted ${count} remote ChangeLog entries.`
  );
}

// --- Change Log Sync Helpers for Remote ---
export async function readChangeLog({ tableName }: { tableName: string }): Promise<any[]> {
  // TODO: Implement remote changelog fetch logic
  return [];
}

export async function applyChangeLogOperation(tableName: string, entry: any): Promise<void> {
  // TODO: Implement remote apply logic
}

export async function addOrUpdateChangeLogEntry(tableName: string, rowId: string, operation: string, timestamp: Date, data?: any): Promise<void> {
  // TODO: Implement remote add/update logic
}

export async function markChangeLogEntrySynced(tableName: string, rowId: string): Promise<void> {
  // TODO: Implement remote mark as synced logic
}
