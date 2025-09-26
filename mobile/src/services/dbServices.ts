// --- Event Emitter for Discussion Updates ---
type DiscussionListener = (discussion: Discussion) => void;
const discussionListeners: DiscussionListener[] = [];

export function addDiscussionListener(listener: DiscussionListener) {
  discussionListeners.push(listener);
  return {
    unsubscribe: () => {
      const idx = discussionListeners.indexOf(listener);
      if (idx !== -1) discussionListeners.splice(idx, 1);
    },
  };
}

function emitDiscussionUpdate(discussion: Discussion) {
  discussionListeners.forEach((listener) => {
    try {
      listener(discussion);
    } catch (e) {
      console.warn('Error in discussion listener', e);
    }
  });
}
// src/services/dbServices.ts
import * as remote from './dbServicesRemote';
// ...existing code...
import { getUID } from '../utils/uidManager';
import { ActivityLog } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENABLE_CATEGORY_SYNC } from './syncConfig';
import { ENABLE_FIRESTORE } from '../firebaseConfig';
import { isPaidUser as planIsPaidUser } from './planManager';

// Helper to enable syncWithCloud for testing
export async function enableSyncWithCloud() {
  await AsyncStorage.setItem('syncWithCloud', 'true');
  console.log('[DEBUG] syncWithCloud set to true');
}

// Helper function to check if remote sync should be used
async function shouldUseRemote(): Promise<boolean> {
  try {
    // First check if Firestore is enabled
    if (!ENABLE_FIRESTORE) {
      console.log('[DEBUG] shouldUseRemote: Firestore disabled');
      return false;
    }

    const paid = await isPaidUser();
    const syncWithCloud =
      (await AsyncStorage.getItem('syncWithCloud')) === 'true';
    console.log('[DEBUG] shouldUseRemote:', { paid, syncWithCloud, result: paid && syncWithCloud });
    return paid && syncWithCloud;
  } catch (e) {
    console.warn('Could not check remote sync settings:', e);
    return false;
  }
}

// Helper function specifically for category operations
async function shouldUseRemoteForCategories(): Promise<boolean> {
  try {
    const baseSync = await shouldUseRemote();
    return baseSync && ENABLE_CATEGORY_SYNC;
  } catch (e) {
    console.warn('Could not check category sync settings:', e);
    return false;
  }
}

interface Discussion {
  id: string;
  discussionId?: string;
  description: string;
  timestamp: Date | string;
  typeSay?: string;
  cleared: boolean;
  uid?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: Date | { toDate(): Date }; // Allow Timestamp from Firebase
  updatedAt: Date | { toDate(): Date }; // Allow Timestamp from Firebase
  synced: boolean;
  syncTimestamp?: Date | { toDate(): Date };
  uid: string;
}

interface SyncEntry {
  id: string;
  tableName: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: Date;
  uid: string;
}

// Update logSyncEntry to use only local (and remote if implemented in the future)
async function logSyncEntry(entry: SyncEntry): Promise<void> {
  try {
  // ...existing code...
    // If remote logging is needed, implement in dbServicesRemote and call here
    // For now, skip remote logging to Firestore directly
  } catch (error) {
    console.error('Error logging SyncEntry:', error);
  }
}

export async function isPaidUser(): Promise<boolean> {
  // Use planManager logic: only premium plan is paid
  return planIsPaidUser();
}

export const findDuplicateActivityLog = async (
  discussionId: string,
  category: string,
  description: string
): Promise<ActivityLog | null> => {
  // console.log('findDuplicateActivityLog called');
  try {
    const uidVal = (await getUID()) || 'unknown';
    if (await shouldUseRemote()) {
      await remote.findDuplicateActivityLog(
        discussionId,
        category,
        description,
        uidVal
      );
    } else {
  
    }
  return null;
  } catch (error) {
    console.error('Error in initializeUser:', error);
    throw error;
  }
};

export async function initializeUser(): Promise<void> {
  // console.log('initializeUser called');
  try {
    if (await shouldUseRemote()) {
      await remote.initializeUser();
    } else {
  
    }
  } catch (error) {
    console.error('Error in initializeUser:', error);
    throw error;
  }
}

export async function addOrUpdateDiscussion(
  description: string,
  typeSay: string = 'tell',
  id?: string
): Promise<string> {
  const useRemote = await shouldUseRemote();
  if (useRemote) {
    console.log('[DISCUSSION] Calling remote.addOrUpdateDiscussion');
    return await remote.addOrUpdateDiscussion(description, typeSay, id as string);
  }
  // If not remote, return a placeholder or throw
  throw new Error('Remote sync is required for addOrUpdateDiscussion');
}

export async function getDiscussions(
  lastX?: number,
  discussionId?: string
): Promise<Discussion[]> {
  // console.log(
  //   'getDiscussions called with lastX:',
  //   lastX,
  //   'discussionId:',
  //   discussionId
  // );
  try {
    const useRemote = await shouldUseRemote();
    if (useRemote) {
      return await remote.getDiscussions(lastX, discussionId);
    }
    return [];
  } catch (error) {
    console.error('getDiscussions error:', error);
    return [];
  }
}

export async function deleteDiscussion(id: string): Promise<void> {
  console.log('deleteDiscussion called with:', id);
  try {
    if (await shouldUseRemote()) {
      await remote.deleteDiscussion(id);
    }
  
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id,
      tableName: 'Discussion',
      operation: 'delete',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in deleteDiscussion:', error);
    throw error;
  }
}

export async function fetchInitialDiscussion(): Promise<Discussion | null> {
  console.log('fetchInitialDiscussion called');
  try {
    if (await shouldUseRemote()) {
      return await remote.fetchInitialDiscussion();
    } else {
      // Local version returns null, so we explicitly return null here
  
      return null;
    }
  } catch (error) {
    console.error('Error in fetchInitialDiscussion:', error);
    return null;
  }
}

export async function getNextOpenDiscussion(lastVisibleDoc?: unknown): Promise<{
  snapshot: Discussion[];
  hasMore: boolean;
  lastVisibleDoc: unknown | null;
}> {
  console.log('getNextOpenDiscussion called with:', lastVisibleDoc);
  try {
    // Pass the correct Firestore document snapshot or undefined
    if (await shouldUseRemote()) {
      const result = await remote.getNextOpenDiscussion(
        lastVisibleDoc as import('firebase/firestore').QueryDocumentSnapshot<
          import('firebase/firestore').DocumentData,
          import('firebase/firestore').DocumentData
        > | undefined
      );
      // Convert result.snapshot to Discussion[] if needed
      if (result && result.snapshot) {
        // If snapshot is already an array, use it. Otherwise, convert QuerySnapshot to array.
        let snapshotArr: Discussion[];
        if (Array.isArray(result.snapshot)) {
          snapshotArr = result.snapshot;
        } else if (typeof result.snapshot.forEach === 'function') {
          snapshotArr = [];
          result.snapshot.forEach((doc: any) => {
            snapshotArr.push(doc.data());
          });
        } else {
          snapshotArr = [];
        }
        return { snapshot: snapshotArr, hasMore: result.hasMore, lastVisibleDoc: result.lastVisibleDoc };
      } else {
        // fallback
        return { snapshot: [], hasMore: false, lastVisibleDoc: null };
      }
    }
    return { snapshot: [], hasMore: false, lastVisibleDoc: null };
  } catch (error) {
    console.error('Error in getNextOpenDiscussion:', error);
    return { snapshot: [], hasMore: false, lastVisibleDoc: null };
  }
}

export async function processPendingTells(): Promise<void> {
  console.log('processPendingTells called');
  try {
    if (await shouldUseRemote()) {
      await remote.processPendingTells();
    }
  
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'ActivityLog',
      operation: 'create',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in processPendingTells:', error);
    throw error;
  }
}

export async function addQuestionDiscussion(
  question: string,
  discussionId: string
): Promise<string> {
  console.log('addQuestionDiscussion called with:', question, discussionId);
  try {
    let remoteResult = '';
    if (await shouldUseRemote()) {
      remoteResult = await remote.addQuestionDiscussion(question, discussionId);
    }
  
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: remoteResult,
      tableName: 'GPTResponses',
      operation: 'create',
      timestamp: new Date(),
      uid,
    });
    return remoteResult;
  } catch (error) {
    console.error('Error in addQuestionDiscussion:', error);
    throw error;
  }
}

export async function processUnclearedGPTResponses(): Promise<void> {
  console.log('processUnclearedGPTResponses called');
  try {
    if (await shouldUseRemote()) {
      await remote.processUnclearedGPTResponses();
    }
  
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'GPTResponses',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in processUnclearedGPTResponses:', error);
    throw error;
  }
}

export async function markDiscussionAsCleared(
  discussionId: string
): Promise<void> {
  console.log('markDiscussionAsCleared called with:', discussionId);
  try {
    if (await shouldUseRemote()) {
      await remote.markDiscussionAsCleared(discussionId);
    }
  
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: discussionId,
      tableName: 'Discussion',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in markDiscussionAsCleared:', error);
    throw error;
  }
}

export async function clearDiscussion(discussionId: string): Promise<boolean> {
  console.log('clearDiscussion called with:', discussionId);
  try {
    let remoteResult = false;
    if (await shouldUseRemote()) {
      remoteResult = await remote.clearDiscussion(discussionId);
    }
  
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: discussionId,
      tableName: 'Discussion',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  return remoteResult;
  } catch (error) {
    console.error('Error in clearDiscussion:', error);
    return false;
  }
}

export async function addOrUpdateActivityLog(): Promise<void> {
  console.log('addOrUpdateActivityLog called');
  try {
    if (await shouldUseRemote()) {
      await remote.addOrUpdateActivityLog();
    }
  
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'ActivityLog',
      operation: 'create',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in addOrUpdateActivityLog:', error);
    throw error;
  }
}

export async function renameFieldToCleared(): Promise<void> {
  console.log('renameFieldToCleared called');
  try {
    if (await shouldUseRemote()) {
      await remote.renameFieldToCleared();
    }
  
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'Discussion',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in renameFieldToCleared:', error);
    throw error;
  }
}

export async function getLastOpenDiscussion(): Promise<{
  id: string;
  description: string;
}> {
  console.log('getLastOpenDiscussion called');
  try {
    if (await shouldUseRemote()) {
      return await remote.getLastOpenDiscussion();
    }
    return { id: '', description: '' };
  } catch (error) {
    console.error('Error in getLastOpenDiscussion:', error);
    throw error;
  }
}

export async function disperseQuestion(
  discussionId: string,
  gptResponseId: string
): Promise<string[] | undefined> {
  console.log('disperseQuestion called with:', discussionId, gptResponseId);
  try {
    if (await shouldUseRemote()) {
      return await remote.disperseQuestion(discussionId, gptResponseId);
    }
    return undefined;
  } catch (error) {
    console.error('Error in disperseQuestion:', error);
    return undefined;
  }
}

export async function addOrUpdateGPTResponse(
  discussionId: string,
  response: string,
  responseType: string,
  cleared: boolean = false
): Promise<void> {
  console.log(
    'addOrUpdateGPTResponse called with:',
    discussionId,
    responseType
  );
  try {
    if (await shouldUseRemote()) {
      await remote.addOrUpdateGPTResponse(
        discussionId,
        response,
        responseType,
        cleared
      );
      const uid = (await getUID()) || 'unknown';
      await logSyncEntry({
        id: new Date().getTime().toString(),
        tableName: 'GPTResponses',
        operation: 'create',
        timestamp: new Date(),
        uid,
      });
    }
  } catch (error) {
    console.error('Error in addOrUpdateGPTResponse:', error);
    throw error;
  }
}

export async function getGPTResponses(discussionId: string): Promise<Record<string, unknown>[]> {
  console.log('getGPTResponses called with:', discussionId);
  try {
    if (await shouldUseRemote()) {
      return await remote.getGPTResponses(discussionId);
    }
    return [];
  } catch (error) {
    console.error('Error in getGPTResponses:', error);
    return [];
  }
}

export async function getParsedGPTResponses(
  discussionId: string
): Promise<string[]> {
  console.log('getParsedGPTResponses called with:', discussionId);
  try {
    if (await shouldUseRemote()) {
      return await remote.getParsedGPTResponses(discussionId);
    }
    return [];
  } catch (error) {
    console.error('Error in getParsedGPTResponses:', error);
    return [];
  }
}

export async function getAIResponse(question: string): Promise<string> {
  console.log('getAIResponse called with:', question);
  try {
    if (await shouldUseRemote()) {
      return await remote.getAIResponse(question);
    }
    return '';
  } catch (error) {
    console.error('Error in getAIResponse:', error);
    throw error;
  }
}

export async function populateCategoryId(): Promise<void> {
  console.log('populateCategoryId called');
  // Removed: local.populateCategoryId
}

export async function syncToCloud(
  tableName: string,
  payload?: Record<string, unknown>,
  method?: 'POST' | 'PUT' | 'DELETE'
): Promise<void> {
  if (payload && method) {
    // Single-record sync
    console.log('syncToCloud (single-record) called with:', tableName, method);
    try {
      // Router-based upload to Firestore for a single record
      if (await shouldUseRemote()) {
        await remote.syncRealmRowsToFirestore(tableName, [payload]);
      }
      const uid = (await getUID()) || 'unknown';
      await logSyncEntry({
        id: Date.now().toString(),
        tableName,
        operation:
          method === 'POST' ? 'create' : method === 'PUT' ? 'update' : 'delete',
        timestamp: new Date(),
        uid,
      });
    } catch (error) {
      console.error('Error in syncToCloud (single-record):', error);
      throw error;
    }
  } else {
    // Full-table sync
    console.log('syncToCloud (full-table) called for:', tableName);
    try {
  // Removed: local.syncToCloud
    } catch (error) {
      console.error('Error in syncToCloud (full-table):', error);
      throw error;
    }
  }
}

export async function getNextActiveAlert(): Promise<Record<string, unknown> | null> {
  console.log('getNextActiveAlert called');
  try {
    if (await shouldUseRemote()) {
      return await remote.getNextActiveAlert();
    }
    return null;
  } catch (error) {
    console.error('Error in getNextActiveAlert:', error);
    return null;
  }
}

export async function addOrUpdateAlert(alertData: Record<string, unknown>): Promise<void> {
  //console.log('addOrUpdateAlert called with:', alertData);
  try {
    if (await shouldUseRemote()) {
      await remote.addOrUpdateAlert(alertData);
    }
  // Removed: local.addOrUpdateAlert
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: (alertData._id as string) || new Date().getTime().toString(),
      tableName: 'Alert',
      operation: alertData._id ? 'update' : 'create',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in addOrUpdateAlert:', error);
    throw error;
  }
}

export async function deactivateAlertByKey(
  key: number | string
): Promise<void> {
  console.log('deactivateAlertByKey called with:', key);
  const keyStr = String(key);
  try {
    if (await shouldUseRemote()) {
      await remote.deactivateAlertByKey(keyStr);
    }
    // For local, if it still expects number, convert to number if possible
    const keyNum = typeof key === 'number' ? key : parseInt(keyStr, 10);
  // Removed: local.deactivateAlertByKey
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: keyStr,
      tableName: 'Alert',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in deactivateAlertByKey:', error);
    throw error;
  }
}

export async function getURLofGPT(
  gpt_name: string
): Promise<{ url: string; apiKey: string } | null> {
  console.log('getURLofGPT called with:', gpt_name);
  try {
    if (await shouldUseRemote()) {
      return await remote.getURLofGPT(gpt_name);
    }
    return { url: '', apiKey: '' };
  } catch (error) {
    console.error('Error in getURLofGPT:', error);
    return { url: '', apiKey: '' };
  }
}

export async function expandFromAbbreviation(
  discussion: string
): Promise<string> {
  // console.log('expandFromAbbreviation called with:', discussion);
  try {
    if (await shouldUseRemote()) {
      return await remote.expandFromAbbreviation(discussion);
    }
    return discussion;
  } catch (error) {
    console.error('Error in expandFromAbbreviation:', error);
    return discussion;
  }
}

export async function restoreLostData(): Promise<void> {
  // console.log('restoreLostData called');
  try {
    await remote.restoreLostData();
    // Removed: local.restoreLostData
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'ActivityLog',
      operation: 'create',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in restoreLostData:', error);
    throw error;
  }
}

export async function getRules(): Promise<Record<string, unknown>[]> {
  //console.log('getRules called');
  try {
  const result = await remote.getRules();
  return result;
  } catch (error) {
    console.error('Error in getRules:', error);
    return [];
  }
}

export async function updateGPTSpecialties(gptSpecialty: {
  id?: number;
  name: string;
  url: string;
  apiKey: string;
}): Promise<void> {
  //console.log('updateGPTSpecialties called with:', gptSpecialty);
  try {
  await remote.updateGPTSpecialties(gptSpecialty);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: gptSpecialty.id ? String(gptSpecialty.id) : Date.now().toString(),
      tableName: 'GPTSpecialties',
      operation: gptSpecialty.id ? 'update' : 'create',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in updateGPTSpecialties:', error);
    throw error;
  }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  //console.log('getActivityLogs called');
  try {
  const result = await remote.getActivityLogs();
  return result;
  } catch (error) {
    console.error('Error in getActivityLogs:', error);
    return [];
  }
}

export async function getParameters(): Promise<Record<string, unknown>[]> {
  //console.log('getParameters called');
  try {
    const result = await remote.getParameters();
    // Ensure result is an array of objects
    if (Array.isArray(result)) {
      return result.map((item) => ({ ...item }));
    }
    return [];
  } catch (error) {
    console.error('Error in getParameters:', error);
    return [];
  }
}

export async function getDescriptionsWithTimestamps(
  categories: string[]
): Promise<string> {
  console.log('getDescriptionsWithTimestamps called with:', categories);
  try {
  const result = await remote.getDescriptionsWithTimestamps(categories);
  return result;
  } catch (error) {
    console.error('Error in getDescriptionsWithTimestamps:', error);
    return '[]';
  }
}

export async function createDocument(data: Record<string, unknown>): Promise<string> {
  //console.log('createDocument called with:', data);
  try {
  const remoteResult = await remote.createDocument(data);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: remoteResult,
      tableName: 'Document',
      operation: 'create',
      timestamp: new Date(),
      uid,
    });
    return remoteResult;
  } catch (error) {
    console.error('Error in createDocument:', error);
    throw error;
  }
}

export async function readDocuments(): Promise<Record<string, unknown>[]> {
  //console.log('readDocuments called');
  try {
  const result = await remote.readDocuments();
  return result;
  } catch (error) {
    console.error('Error in readDocuments:', error);
    return [];
  }
}

export async function updateDocument(docId: string, data: Record<string, unknown>): Promise<void> {
  //console.log('updateDocument called with:', docId, data);
  try {
  await remote.updateDocument(docId, data);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: docId,
      tableName: 'Document',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in updateDocument:', error);
    throw error;
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  console.log('deleteDocument called with:', docId);
  try {
  await remote.deleteDocument(docId);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: docId,
      tableName: 'Document',
      operation: 'delete',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    throw error;
  }
}

export async function getDistinctCategories(): Promise<string[]> {
  //  console.log('getDistinctCategories called');
  try {
  const result = await remote.getDistinctCategories();
  return result;
  } catch (error) {
    console.error('Error in getDistinctCategories:', error);
    return [];
  }
}

export async function getCategoryById(id: string): Promise<Category | null> {
  //  console.log('getCategory called with:', id);
  try {
  // Remote doesn't support getCategoryById with id parameter yet
  return null;
  } catch (error) {
    console.error('Error in getCategory:', error);
    return null;
  }
}

export async function insertJsonFile(jsonData: Array<{ category: string; value: string }>): Promise<void> {
  // console.log('insertJsonFile called with:', jsonData);
  try {
  await remote.insertJsonFile(jsonData);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'ActivityLog',
      operation: 'create',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in insertJsonFile:', error);
    throw error;
  }
}

export async function queryAllFieldsByCategories(
  categories: string[]
): Promise<string[]> {
  console.log('queryAllFieldsByCategories called with:', categories);
  try {
  const result = await remote.queryAllFieldsByCategories(categories);
  return result;
  } catch (error) {
    console.error('Error in queryAllFieldsByCategories:', error);
    return [];
  }
}

export async function synchronizeActivityLog(
  appVersion: string
): Promise<void> {
  console.log('synchronizeActivityLog called with appVersion:', appVersion);
  try {
  await remote.synchronizeActivityLog(appVersion);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'ActivityLog',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in synchronizeActivityLog:', error);
    throw error;
  }
}

export async function synchronizeDiscussions(
  appVersion: string
): Promise<void> {
  console.log('synchronizeDiscussions called with appVersion:', appVersion);
  try {
  await remote.synchronizeDiscussions(appVersion);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'Discussion',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in synchronizeDiscussions:', error);
    throw error;
  }
}

export async function synchronizeCategories(appVersion: string): Promise<void> {
  console.log('synchronizeCategories called with appVersion:', appVersion);
  try {
  await remote.synchronizeCategories(appVersion);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'Category',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in synchronizeCategories:', error);
    throw error;
  }
}

export async function getCategories(): Promise<Category[]> {
  console.log('getCategories called');
  try {
  // Not implemented: getCategories (local only)
  return [];
  } catch (error) {
    console.error('Error in getCategories:', error);
    throw error;
  }
}

export async function getCategoryNames(): Promise<string[]> {
  console.log('getCategoryNames called');
  try {
  // Not implemented: getCategoryNames (local only)
  return [];
  } catch (error) {
    console.error('Error in getCategoryNames:', error);
    throw error;
  }
}

export async function addOrUpdateCategory(
  name: string,
  description?: string,
  id?: string
): Promise<string> {
  console.log('addOrUpdateCategory called with:', { name, description, id });
  let categoryId: string | undefined = undefined;
  let localError: any = null;
  let remoteError: any = null;
  const uid = (await getUID()) || 'unknown';
  // Only remote supported
  try {
    categoryId = await remote.addOrUpdateCategory(name, description, id);
  } catch (err) {
    remoteError = err;
  }
  if (categoryId) {
    await logSyncEntry({
      id: categoryId,
      tableName: 'Category',
      operation: id ? 'update' : 'create',
      timestamp: new Date(),
      uid,
    });
    return categoryId;
  } else {
    console.error('Error in addOrUpdateCategory:', { remoteError });
    throw remoteError || new Error('Failed to create or update category');
  }
}

export async function checkCategoryReferences(categoryId: string): Promise<{
  hasReferences: boolean;
  referenceCount: number;
  references: { tableName: string; count: number }[];
}> {
  // Not implemented: checkCategoryReferences (local only)
  return { hasReferences: false, referenceCount: 0, references: [] };
}

export async function findCategoryByName(name: string): Promise<Category | null> {
  console.log('findCategoryByName called with:', name);
  try {
  // Not implemented: findCategoryByName (local only)
  return null;
  } catch (error) {
    console.error('Error in findCategoryByName:', error);
    throw error;
  }
}

export async function mergeCategoryReferences(
  fromCategoryId: string,
  toCategoryId: string
): Promise<void> {
  console.log('mergeCategoryReferences called with:', {
    fromCategoryId,
    toCategoryId,
  });
  try {
  // Not implemented: mergeCategoryReferences (local only)
  } catch (error) {
    console.error('Error in mergeCategoryReferences:', error);
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  console.log('deleteCategory called with:', id);
  try {
  await remote.deleteCategory(id);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id,
      tableName: 'Category',
      operation: 'delete',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    throw error;
  }
}

// Delete ActivityLog (router)
export async function deleteActivityLog(activityLogId: string): Promise<void> {
  await remote.deleteActivityLog(activityLogId);
  const uid = (await getUID()) || 'unknown';
  await logSyncEntry({
    id: activityLogId,
    tableName: 'ActivityLog',
    operation: 'delete',
    timestamp: new Date(),
    uid,
  });
}

// Create ActivityLog (router)
export async function createActivityLog(
  activityLog: Omit<ActivityLog, 'id'>
): Promise<string> {
  return await remote.createActivityLog(activityLog);
}

export async function updateActivityLogCategory(
  activityLogId: string,
  category: string
): Promise<void> {
  console.log(
    'updateActivityLogCategory called with:',
    activityLogId,
    category
  );
  try {
  await remote.updateActivityLogCategory(activityLogId, category);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: activityLogId,
      tableName: 'ActivityLog',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in updateActivityLogCategory:', error);
    throw error;
  }
}

export async function createRuleCandidate(data: {
  discussionId: string;
  category: string;
  description: string;
  uid: string;
}): Promise<void> {
  // console.log('createRuleCandidate called with:', data);
  try {
  await remote.createRuleCandidate(data);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime().toString(),
      tableName: 'RuleCandidate',
      operation: 'create',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in createRuleCandidate:', error);
    throw error;
  }
}

/**
 * Syncs all remote ActivityLog and Discussion rows (including legacy/unsynced) into local Realm.
 * This will populate Realm with any remote rows created by legacy apps or other clients.
 */
export async function syncFromRemote() {
  // Not implemented: syncFromRemote (local only)
}

// ...existing code...

/**
 * Utility: Run all sync functions (Discussions, ActivityLog, Categories, and full remote sync)
 */
export async function runAllSyncFunctions(appVersion = '1.1.0') {
  // console.log('[UTIL] Running all sync functions...');
  await synchronizeDiscussions(appVersion);
  await synchronizeActivityLog(appVersion);
  await synchronizeCategories(appVersion);
  // syncFromRemote not implemented
  console.log('[UTIL] All sync functions complete.');
}

/**
 * Utility: Delete all rows in local Discussion, ActivityLog, ChangeLog, and all rows in Firebase changelog
 */
export async function deleteAllLocalAndRemoteRows() {
  console.log('[UTIL] Deleting all local and remote rows...');
  await remote.deleteAllRemoteChangeLogs();
  console.log('[UTIL] All remote rows deleted.');
}

/**
 * Utility: Insert 10 rows each into Discussion and ActivityLog, then exit
 */
export async function insertTestRowsAndExit() {
  console.log(
    '[UTIL] Inserting 10 test rows into Discussion and ActivityLog...'
  );
  for (let i = 0; i < 10; i++) {
    await addOrUpdateDiscussion(`Test Discussion ${i + 1}`, 'test', undefined);
    // Not implemented: createActivityLog (local only)
  }
  console.log('[UTIL] Test rows inserted. Exiting process.');
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(0);
  }
}

/**
 * Utility: Create sample categories for testing
 */
export async function createSampleCategories() {
  console.log('[UTIL] Creating sample categories...');

  const sampleCategories = [
    {
      name: 'Health',
      description: 'Health-related activities and discussions',
    },
    { name: 'Work', description: 'Work and productivity matters' },
    { name: 'Learning', description: 'Educational and learning activities' },
    { name: 'Family', description: 'Family time and relationships' },
    { name: 'Exercise', description: 'Physical fitness and exercise' },
  ];

  for (const category of sampleCategories) {
    try {
      await addOrUpdateCategory(category.name, category.description);
      console.log(`[UTIL] Created category: ${category.name}`);
    } catch (error) {
      console.warn(`[UTIL] Failed to create category ${category.name}:`, error);
    }
  }

  console.log('[UTIL] Sample categories creation complete.');
}

export async function createCategoriesFromActivityLogs() {
  console.log('[UTIL] Creating categories from existing ActivityLog data...');

  try {
    // Get all activity logs to extract distinct categories
    // Not implemented: createCategoriesFromActivityLogs (local only)
    return {
      total: 0,
      created: 0,
      skipped: 0,
      categories: [],
    };
  } catch (error) {
    console.error('[UTIL] Error creating categories from ActivityLog:', error);
    throw error;
  }
}

export async function addChangeLogEntry(
  tableName: string,
  rowId: string,
  operation: 'create' | 'update' | 'delete',
  timestamp?: Date
): Promise<void> {
  console.log('addChangeLogEntry called with:', tableName, rowId, operation);
  try {
    if (await shouldUseRemote()) {
      // If remote implementation exists, call it here
      // await remote.addChangeLogEntry(tableName, rowId, operation, timestamp);
    }
  // Not implemented: addChangeLogEntry (local only)
  } catch (error) {
    console.error('Error in addChangeLogEntry:', error);
    throw error;
  }
}

export async function importLegacyDiscussions(
  discussions: Discussion[]
): Promise<number> {
  console.log(
    'importLegacyDiscussions called with:',
    discussions.length,
    'discussions'
  );
  try {
    // Map to ensure required properties are present
    const mappedDiscussions = discussions.map(d => ({
      ...d,
      discussionId: d.discussionId || d.id, // Use id as fallback for discussionId
      typeSay: d.typeSay || 'tell' // Default typeSay
    }));
  // Not implemented: importLegacyDiscussions (local only)
  return 0;
  } catch (error) {
    console.error('Error in importLegacyDiscussions:', error);
    throw error;
  }
}

export async function importLegacyActivityLogs(
  activityLogs: ActivityLog[]
): Promise<number> {
  console.log(
    'importLegacyActivityLogs called with:',
    activityLogs.length,
    'activity logs'
  );
  try {
  // Not implemented: importLegacyActivityLogs (local only)
  return 0;
  } catch (error) {
    console.error('Error in importLegacyActivityLogs:', error);
    throw error;
  }
}

export async function ensureStringIds(tableName: string): Promise<void> {
  console.log('ensureStringIds called for:', tableName);
  try {
  // Not implemented: ensureStringIds (local only)
  } catch (error) {
    console.error('Error in ensureStringIds:', error);
    throw error;
  }
}

export async function printAllRealmDataToTerminal(): Promise<void> {
  console.log('printAllRealmDataToTerminal called');
  try {
  // Not implemented: printAllRealmDataToTerminal (local only)
  } catch (error) {
    console.error('Error in printAllRealmDataToTerminal:', error);
    throw error;
  }
}

export async function debugPrintAllActivityLogs(): Promise<void> {
  console.log('debugPrintAllActivityLogs called');
  try {
  // Not implemented: debugPrintAllActivityLogs (local only)
  } catch (error) {
    console.error('Error in debugPrintAllActivityLogs:', error);
    throw error;
  }
}

export async function debugPrintAllDiscussions(): Promise<void> {
  console.log('debugPrintAllDiscussions called');
  try {
  // Not implemented: debugPrintAllDiscussions (local only)
  } catch (error) {
    console.error('Error in debugPrintAllDiscussions:', error);
    throw error;
  }
}

// ---------------- CandidateResult Public API ----------------
export async function saveCandidateResult(selectedId: string | null): Promise<string> {
  try {
    const uid = (await getUID()) || 'unknown';
    // Always save locally first
    // Only save remote
    const result = await remote.saveCandidateResult(selectedId);
    // Log the sync entry
    await logSyncEntry({
      id: result,
      tableName: 'Votes',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
    return result;
  } catch (e) {
    console.error('Error in saveCandidateResult:', e);
    throw e;
  }
}

export async function getCandidateResult(): Promise<{ id: string; selectedId?: string | null; timestamp: Date } | null> {
  try {
  // Not implemented: getCandidateResult (local only)
  return null;
  } catch (e) {
    console.error('Error in getCandidateResult:', e);
    return null;
  }
}

export async function appendCandidateResultHistory(selectedId: string | null, electionId?: string): Promise<string> {
  try {
    const uid = (await getUID()) || 'unknown';
  // Only use Firebase/cloud for voting history
  return await remote.appendCandidateResultHistory(selectedId, uid, electionId);
  } catch (e) {
    console.error('Error in appendCandidateResultHistory:', e);
    throw e;
  }
}

export async function getCandidateResultHistory(limit = 50): Promise<{ id: string; selectedId?: string | null; timestamp: Date }[]> {
  try {
  // Not implemented: getCandidateResultHistory (local only)
  return [];
  } catch (e) {
    console.error('Error in getCandidateResultHistory:', e);
    return [];
  }
}

export async function clearCandidateResultHistory(): Promise<number> {
  try {
  // Not implemented: clearCandidateResultHistory (local only)
  return 0;
  } catch (e) {
    console.error('Error in clearCandidateResultHistory:', e);
    throw e;
  }
}

export async function pruneCandidateResultHistory(max: number): Promise<number> {
  try {
  // Not implemented: pruneCandidateResultHistory (local only)
  return 0;
  } catch (e) {
    console.error('Error in pruneCandidateResultHistory:', e);
    throw e;
  }
}

export async function removeDuplicateActivityLogs(): Promise<{
  duplicatesFound: number;
  duplicatesRemoved: number;
}> {
  console.log('removeDuplicateActivityLogs called');
  try {
  // Not implemented: removeDuplicateActivityLogs (local only)
  return { duplicatesFound: 0, duplicatesRemoved: 0 };
  } catch (error) {
    console.error('Error in removeDuplicateActivityLogs:', error);
    throw error;
  }
}

// Simple debug function to test data fetching
export async function debugTestDataFetch(): Promise<void> {
  console.log('[DEBUG] Testing data fetch functions...');

  try {
    console.log('[DEBUG] Testing getActivityLogs...');
  // Not implemented: debugTestDataFetch (local only)
  } catch (error) {
    console.error('[DEBUG] Error in debugTestDataFetch:', error);
  }
}

/**
 * Bi-directional, last-write-wins sync between local Realm and remote Firebase using a unified change log.
 * All data changes must be recorded in ChangeLog. No direct changes to data are allowed.
 * This function should be called by the manual sync trigger.
 */
export async function syncBidirectionalChangeLog() {
  const tables = ['ActivityLog', 'Discussion', 'Category']; // Add more as needed
  // Not implemented: syncBidirectionalChangeLog (local only)
  console.log('[SYNC] Bi-directional change log sync not implemented.');
}
