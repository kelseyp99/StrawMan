import { auth, db } from '../firebaseConfig';
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

// Constants to match dbServicesLocal.ts
const ENABLE_ACTIVITYLOG_SYNC = false;
const ENABLE_DISCUSSION_SYNC = false;

// Interfaces (same as dbServicesLocal.ts)
interface Discussion {
  id: number;
  discussionId?: number;
  description: string;
  timestamp: Date | string;
  typeSay?: string;
  cleared: boolean;
  uid?: string;
}

export interface ActivityLog {
  id: number;
  discussionId: number;
  category: string;
  description: string;
  timestamp: Date;
  cleared: boolean;
  responseType?: string;
  uid: string;
}

export interface Parameters {
  parameterName: string;
  parameterValue?: string;
}

interface Alert {
  id: number;
  message: string;
  timestamp: Date;
  severity: string;
  isActive: boolean;
  nextTrigger: Date;
  createdAt: Date;
  uid: string;
}

interface GPTSpecialty {
  id: number;
  name: string;
  url: string;
  apiKey: string;
}

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
    const discussionId = id || String(new Date().getTime());
    await setDoc(
      doc(db, `Users/${uid}/Discussion`, discussionId),
      {
        id: Number(discussionId),
        discussionId: Number(discussionId),
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
export async function deactivateAlertByKey(key: number): Promise<void> {
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
      id: Number(doc.id),
      discussionId: doc.data().discussionId,
      category: doc.data().category,
      description: doc.data().description,
      timestamp: doc.data().timestamp.toDate(),
      cleared: doc.data().cleared,
      responseType: doc.data().responseType,
      uid: doc.data().uid,
      synced: doc.data().synced || false,
      syncTimestamp: doc.data().syncTimestamp?.toDate(),
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
    console.log(`Starting ActivityLog sync with appVersion: ${appVersion}`);
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.error('No user ID for ActivityLog synchronization.');
      return;
    }

    console.log(`Synchronizing ActivityLog for UID: ${uid}`);
    const batch = writeBatch(db);
    let operations = 0;

    // Copy from /ActivityLog to Users/{uid}/ActivityLog
    const globalActivityLogQuery = query(collection(db, 'ActivityLog'));
    const globalSnapshot = await getDocs(globalActivityLogQuery);
    console.log(
      `Found ${globalSnapshot.docs.length} global ActivityLog entries`
    );

    for (const globalDoc of globalSnapshot.docs) {
      const globalData = globalDoc.data() as ActivityLog;
      if (globalData.uid && globalData.uid !== uid) {
        console.log(
          `Skipping ActivityLog ${globalDoc.id} (owned by ${globalData.uid})`
        );
        continue;
      }

      const userActivityLogRef = doc(
        db,
        `Users/${uid}/ActivityLog`,
        globalDoc.id
      );
      const userDoc = await getDoc(userActivityLogRef);
      if (!userDoc.exists()) {
        batch.set(userActivityLogRef, {
          ...globalData,
          id: globalDoc.id,
          uid,
          timestamp: globalData.timestamp || Timestamp.fromDate(new Date()),
        });
        console.log(
          `Queued copy of ActivityLog ${globalDoc.id} to Users/${uid}/ActivityLog`
        );
        operations++;
      } else {
        console.log(
          `ActivityLog ${globalDoc.id} already exists in Users/${uid}/ActivityLog`
        );
      }
    }

    // Copy from Users/{uid}/ActivityLog to /ActivityLog
    const userActivityLogQuery = query(
      collection(db, `Users/${uid}/ActivityLog`)
    );
    const userSnapshot = await getDocs(userActivityLogQuery);
    console.log(`Found ${userSnapshot.docs.length} user ActivityLog entries`);

    for (const userDoc of userSnapshot.docs) {
      const userData = userDoc.data() as ActivityLog;
      if (!userData.uid) {
        console.warn(
          `ActivityLog ${userDoc.id} in Users/${uid}/ActivityLog missing uid, skipping`
        );
        continue;
      }
      const globalActivityLogRef = doc(db, 'ActivityLog', userDoc.id);
      const globalDoc = await getDoc(globalActivityLogRef);
      if (!globalDoc.exists()) {
        batch.set(globalActivityLogRef, {
          ...userData,
          id: userDoc.id,
          uid,
          timestamp: userData.timestamp || Timestamp.fromDate(new Date()),
        });
        console.log(`Queued copy of ActivityLog ${userDoc.id} to /ActivityLog`);
        operations++;
      } else {
        console.log(`ActivityLog ${userDoc.id} already exists in /ActivityLog`);
      }
    }

    if (operations === 0) {
      console.log('No ActivityLog entries to synchronize.');
      return;
    }

    console.log(`Committing batch with ${operations} operations...`);
    await batch.commit();
    console.log(
      `ActivityLog synchronization completed successfully with ${operations} operations.`
    );
  } catch (error) {
    console.error('Error synchronizing ActivityLog:', error);
    if ((error as any).code === 'permission-denied') {
      console.error(
        'Permission denied. Check Firestore security rules for /ActivityLog and Users/{uid}/ActivityLog.'
      );
    }
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

    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.error('No user ID for synchronization.');
      return;
    }

    console.log('Starting discussion synchronization...');
    const batch = writeBatch(db);

    const globalDiscussionQuery = query(collection(db, 'Discussion'));
    const globalSnapshot = await getDocs(globalDiscussionQuery);
    console.log(
      `Found ${globalSnapshot.docs.length} global Discussion entries`
    );

    for (const globalDoc of globalSnapshot.docs) {
      const globalData = globalDoc.data() as Discussion;
      if (globalData.uid && globalData.uid !== uid) {
        console.log(
          `Skipping Discussion ${globalDoc.id} (owned by ${globalData.uid})`
        );
        continue;
      }

      const userDiscussionRef = doc(
        db,
        `Users/${uid}/Discussion`,
        globalDoc.id
      );
      const userDoc = await getDoc(userDiscussionRef);
      if (!userDoc.exists()) {
        batch.set(userDiscussionRef, {
          ...globalData,
          id: globalDoc.id,
          discussionId: globalDoc.id,
          uid,
          timestamp: globalData.timestamp || new Date(),
        });
        console.log(
          `Queued copy of Discussion ${globalDoc.id} to Users/${uid}/Discussion`
        );
      } else {
        console.log(
          `Discussion ${globalDoc.id} already exists in Users/${uid}/Discussion`
        );
      }
    }

    const userDiscussionQuery = query(
      collection(db, `Users/${uid}/Discussion`)
    );
    const userSnapshot = await getDocs(userDiscussionQuery);
    console.log(`Found ${userSnapshot.docs.length} user Discussion entries`);

    for (const userDoc of userSnapshot.docs) {
      const userData = userDoc.data() as Discussion;
      const globalDiscussionRef = doc(db, 'Discussion', userDoc.id);
      const globalDoc = await getDoc(globalDiscussionRef);
      if (!globalDoc.exists()) {
        batch.set(globalDiscussionRef, {
          ...userData,
          id: userDoc.id,
          discussionId: userDoc.id,
          timestamp: userData.timestamp || new Date(),
        });
        console.log(`Queued copy of Discussion ${userDoc.id} to /Discussion`);
      } else {
        console.log(`Discussion ${userDoc.id} already exists in /Discussion`);
      }
    }

    await batch.commit();
    console.log('Discussion synchronization completed.');
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
        await deleteDoc(discussionRef);
        console.log(`Discussion with ID ${id} deleted.`);
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

export const markDiscussionAsCleared = async (discussionId: string) => {
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

//////////////////////////////////////////
// Helper Functions for Cloud Sync //
//////////////////////////////////////////

export async function syncToCloud(
  tableName: string,
  payload: any,
  method: 'POST' | 'PUT' | 'DELETE'
): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for sync to cloud operation');
  }
  const url = `http://localhost:5155/api/${tableName.toLowerCase()}`;
  try {
    const config = { headers: { 'Content-Type': 'application/json' } };
    let response;
    if (method === 'POST') {
      response = await fetch(url, {
        method,
        headers: config.headers,
        body: JSON.stringify(payload),
      });
    } else if (method === 'PUT') {
      response = await fetch(url, {
        method,
        headers: config.headers,
        body: JSON.stringify(payload),
      });
    } else if (method === 'DELETE') {
      response = await fetch(`${url}/${payload.id}`, {
        method,
        headers: config.headers,
      });
    }
    console.log(`${tableName} synced successfully.`);
  } catch (error) {
    console.error(`Error syncing ${tableName} to cloud:`, error);
  }
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
    console.log(`Expanded '${discussion}' to '${expandedForm}'`);
    return expandedForm;
  } else {
    console.log(`Unable to expand abbreviation '${discussion}'`);
    return discussion;
  }
}

//////////////////////////////////////////
// Exporting Helper Functions //
//////////////////////////////////////////

/* async function updateDiscussions() {
    const discussionsSnapshot = await getDocs(collection(db, 'Discussion'));
    const batch = writeBatch(db);
    
    discussionsSnapshot.forEach((discussionDoc) => {
      const docRef = doc(db, 'Discussion', discussionDoc.id);
      batch.update(docRef, { Cleared: false });
    });
    
    await batch.commit(); 

    const snapshot = await getDocs(collection(db, "Discussion"));
    snapshot.forEach(doc => {
        console.log(doc.id, " => ", doc.data());
    });   
}
*/

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

// ... other imports and code ...

export async function restoreLostData(): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for restore lost data operation');
  }
  const collectionRef = collection(db, `Users/${uid}/ActivityLog`);
  for (const entry of lostData) {
    try {
      const docRef = doc(collectionRef, entry.id);
      await setDoc(docRef, {
        typeSay: entry.typeSay,
        description: entry.description,
        timestamp: Timestamp.fromMillis(entry.timestamp),
        uid: uid,
      });
      console.log(`Restored document: ${entry.id}`);
    } catch (error) {
      console.error(`Failed to restore document ${entry.id}:`, error);
    }
  }
  console.log('Data restoration completed!');
}

// ... other exports ...

export async function getRules() {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get rules operation');
  }
  try {
    const rulesRef = collection(db, 'Rules');
    const q = query(
      rulesRef,
      orderBy('isRegex', 'desc'),
      orderBy('priority', 'asc')
    );
    const snapshot = await getDocs(q);
    const rules = snapshot.docs.map((doc) => doc.data() as Rule);
    return rules;
  } catch (error) {
    console.error('Error fetching rules:', error);
    throw error;
  }
}

interface Rule {
  category: string;
  pattern: string;
  isRegex: boolean;
  priority: number;
}

// Run the function
// restoreLostData();
