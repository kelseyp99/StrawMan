// src/services/dbServices.ts
import * as remote from './dbServicesRemote';
import * as local from './dbServicesLocal';
import { getUID } from '../utils/uidManager';
import { ActivityLog } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENABLE_CATEGORY_SYNC } from './syncConfig';
import { ENABLE_FIRESTORE } from '../firebaseConfig';

// Helper function to check if remote sync should be used
async function shouldUseRemote(): Promise<boolean> {
  try {
    // First check if Firestore is enabled
    if (!ENABLE_FIRESTORE) {
      return false;
    }
    
    const paid = await isPaidUser();
    const syncWithCloud =
      (await AsyncStorage.getItem('syncWithCloud')) === 'true';
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
  createdAt: Date | any; // Allow Timestamp from Firebase
  updatedAt: Date | any; // Allow Timestamp from Firebase
  synced: boolean;
  syncTimestamp?: Date | any;
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
    // Log to Realm via dbServicesLocal.ts
    await local.logSyncEntry(entry);
    // If remote logging is needed, implement in dbServicesRemote and call here
    // For now, skip remote logging to Firestore directly
  } catch (error) {
    console.error('Error logging SyncEntry:', error);
  }
}

export async function isPaidUser(): Promise<boolean> {
  try {
    // Check AsyncStorage for paid user status (for testing/demo purposes)
    const paidStatus = await AsyncStorage.getItem('isPaidUser');
    return paidStatus === 'true';
  } catch (error) {
    console.warn('Could not check paid user status:', error);
    return false; // Default to free user
  }
}

export const findDuplicateActivityLog = async (
  discussionId: string,
  category: string,
  description: string,
  uid: string // keep for remote, but not for local
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
      await local.findDuplicateActivityLog(discussionId, category, description); // removed uid for local
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
      await local.initializeUser();
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

  // Always save locally first
  await local.initializeUser();
  const result = await local.addOrUpdateDiscussion(description, typeSay, id);

  // Only save remote if useRemote is true
  if (useRemote) {
    console.log('[DISCUSSION] Calling remote.addOrUpdateDiscussion');
    await remote.addOrUpdateDiscussion(description, typeSay, id as string);
  }

  // Log SyncEntry if remote is enabled
  if (useRemote) {
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: result,
      tableName: 'Discussion',
      operation: id ? 'update' : 'create',
      timestamp: new Date(),
      uid,
    });
    //  console.log('[DISCUSSION] SyncEntry logged for ID:', result);
  }

  //console.log('[DISCUSSION] Returning result:', result);
  return result;
}

export async function getDiscussions(
  lastX?: number,
  discussionId?: string
): Promise<any[]> {
  // console.log(
  //   'getDiscussions called with lastX:',
  //   lastX,
  //   'discussionId:',
  //   discussionId
  // );
  try {
    const useRemote = await shouldUseRemote();
    const result = useRemote
      ? await remote.getDiscussions(lastX, discussionId)
      : await local.getDiscussions(lastX, discussionId);
    //console.log('getDiscussions result:', result);
    return result;
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
    await local.deleteDiscussion(id);
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

export async function fetchInitialDiscussion(): Promise<any | null> {
  console.log('fetchInitialDiscussion called');
  try {
    const result = (await shouldUseRemote())
      ? await remote.fetchInitialDiscussion()
      : await local.fetchInitialDiscussion();
    return result;
  } catch (error) {
    console.error('Error in fetchInitialDiscussion:', error);
    return null;
  }
}

export async function getNextOpenDiscussion(lastVisibleId?: string): Promise<{
  snapshot: any;
  hasMore: boolean;
  lastVisibleDoc: any;
}> {
  console.log('getNextOpenDiscussion called with:', lastVisibleId);
  try {
    const result = (await shouldUseRemote())
      ? await remote.getNextOpenDiscussion(lastVisibleId)
      : await local.getNextOpenDiscussion(lastVisibleId); // pass string
    return result;
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
    await local.processPendingTells();
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
    await local.addQuestionDiscussion(question, discussionId);
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
    await local.processUnclearedGPTResponses();
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
    await local.markDiscussionAsCleared(discussionId);
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
    const localResult = await local.clearDiscussion(discussionId);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: discussionId,
      tableName: 'Discussion',
      operation: 'update',
      timestamp: new Date(),
      uid,
    });
    return remoteResult && localResult;
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
    await local.addOrUpdateActivityLog();
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
    await local.renameFieldToCleared();
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
    const result = (await shouldUseRemote())
      ? await remote.getLastOpenDiscussion()
      : await local.getLastOpenDiscussion();
    return result;
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
    const result = (await shouldUseRemote())
      ? await remote.disperseQuestion(discussionId, gptResponseId)
      : await local.disperseQuestion(discussionId, gptResponseId);
    return result;
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
    }
    await local.addOrUpdateGPTResponse(
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
  } catch (error) {
    console.error('Error in addOrUpdateGPTResponse:', error);
    throw error;
  }
}

export async function getGPTResponses(discussionId: string): Promise<any[]> {
  console.log('getGPTResponses called with:', discussionId);
  try {
    const result = (await shouldUseRemote())
      ? await remote.getGPTResponses(discussionId)
      : await local.getGPTResponses(discussionId);
    return result;
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
    const result = (await shouldUseRemote())
      ? await remote.getParsedGPTResponses(discussionId)
      : await local.getParsedGPTResponses(discussionId);
    return result;
  } catch (error) {
    console.error('Error in getParsedGPTResponses:', error);
    return [];
  }
}

export async function getAIResponse(question: string): Promise<string> {
  console.log('getAIResponse called with:', question);
  try {
    const result = (await shouldUseRemote())
      ? await remote.getAIResponse(question)
      : await local.getAIResponse(question);
    return result;
  } catch (error) {
    console.error('Error in getAIResponse:', error);
    throw error;
  }
}

export async function populateCategoryId(): Promise<void> {
  console.log('populateCategoryId called');
  try {
    await local.populateCategoryId();
  } catch (error) {
    console.error('Error in populateCategoryId:', error);
    throw error;
  }
}

export async function syncToCloud(
  tableName: string,
  payload?: any,
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
      // Use the local syncToCloud, which uploads all unsynced rows via the router
      await local.syncToCloud(tableName, undefined, undefined);
    } catch (error) {
      console.error('Error in syncToCloud (full-table):', error);
      throw error;
    }
  }
}

export async function getNextActiveAlert(): Promise<any | null> {
  console.log('getNextActiveAlert called');
  try {
    const result = (await shouldUseRemote())
      ? await remote.getNextActiveAlert()
      : await local.getNextActiveAlert();
    return result;
  } catch (error) {
    console.error('Error in getNextActiveAlert:', error);
    return null;
  }
}

export async function addOrUpdateAlert(alertData: any): Promise<void> {
  //console.log('addOrUpdateAlert called with:', alertData);
  try {
    if (await shouldUseRemote()) {
      await remote.addOrUpdateAlert(alertData);
    }
    await local.addOrUpdateAlert(alertData);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: alertData._id || new Date().getTime().toString(),
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
    await local.deactivateAlertByKey(keyNum);
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
    const result = (await shouldUseRemote())
      ? await remote.getURLofGPT(gpt_name)
      : await local.getURLofGPT(gpt_name);
    return result;
  } catch (error) {
    console.error('Error in getURLofGPT:', error);
    return null;
  }
}

export async function expandFromAbbreviation(
  discussion: string
): Promise<string> {
  // console.log('expandFromAbbreviation called with:', discussion);
  try {
    const result = (await shouldUseRemote())
      ? await remote.expandFromAbbreviation(discussion)
      : await local.expandFromAbbreviation(discussion);
    return result;
  } catch (error) {
    console.error('Error in expandFromAbbreviation:', error);
    return discussion;
  }
}

export async function restoreLostData(): Promise<void> {
  // console.log('restoreLostData called');
  try {
    await remote.restoreLostData();
    await local.restoreLostData();
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

export async function getRules(): Promise<any[]> {
  //console.log('getRules called');
  try {
    const result = (await shouldUseRemote())
      ? await remote.getRules()
      : await local.getRules();
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
    await local.updateGPTSpecialties(gptSpecialty);
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

export async function getActivityLogs(): Promise<any[]> {
  //console.log('getActivityLogs called');
  try {
    const result = (await shouldUseRemote())
      ? await remote.getActivityLogs()
      : await local.getActivityLogs();
    return result;
  } catch (error) {
    console.error('Error in getActivityLogs:', error);
    return [];
  }
}

export async function getParameters(): Promise<any[]> {
  //console.log('getParameters called');
  try {
    const result = (await shouldUseRemote())
      ? await remote.getParameters()
      : await local.getParameters();
    return result;
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
    const result = (await shouldUseRemote())
      ? await remote.getDescriptionsWithTimestamps(categories)
      : await local.getDescriptionsWithTimestamps(categories);
    return result;
  } catch (error) {
    console.error('Error in getDescriptionsWithTimestamps:', error);
    return '[]';
  }
}

export async function createDocument(data: any): Promise<string> {
  //console.log('createDocument called with:', data);
  try {
    const remoteResult = await remote.createDocument(data);
    await local.createDocument(data);
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

export async function readDocuments(): Promise<any[]> {
  //console.log('readDocuments called');
  try {
    const result = (await shouldUseRemote())
      ? await remote.readDocuments()
      : await local.readDocuments();
    return result;
  } catch (error) {
    console.error('Error in readDocuments:', error);
    return [];
  }
}

export async function updateDocument(docId: string, data: any): Promise<void> {
  //console.log('updateDocument called with:', docId, data);
  try {
    await remote.updateDocument(docId, data);
    await local.updateDocument(docId, data);
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
    await local.deleteDocument(docId);
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
    const result = (await shouldUseRemote())
      ? await remote.getDistinctCategories()
      : await local.getDistinctCategories();
    return result;
  } catch (error) {
    console.error('Error in getDistinctCategories:', error);
    return [];
  }
}

export async function getCategoryById(id: string): Promise<Category | null> {
  //  console.log('getCategory called with:', id);
  try {
    const result = (await shouldUseRemoteForCategories())
      ? null // Remote doesn't support getCategoryById with id parameter yet
      : await local.getCategoryById(id);
    return result;
  } catch (error) {
    console.error('Error in getCategory:', error);
    return null;
  }
}

export async function insertJsonFile(jsonData: any): Promise<void> {
  // console.log('insertJsonFile called with:', jsonData);
  try {
    await remote.insertJsonFile(jsonData);
    await local.insertJsonFile(jsonData);
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
    const result = (await shouldUseRemote())
      ? await remote.queryAllFieldsByCategories(categories)
      : await local.queryAllFieldsByCategories(categories);
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
    await local.synchronizeActivityLog(appVersion);
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
    await local.synchronizeDiscussions(appVersion);
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
    if (await shouldUseRemoteForCategories()) {
      await remote.synchronizeCategories(appVersion);
    }
    await local.synchronizeCategories(appVersion);
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
    if (await shouldUseRemoteForCategories()) {
      return await remote.getCategories();
    } else {
      return await local.getCategories();
    }
  } catch (error) {
    console.error('Error in getCategories:', error);
    throw error;
  }
}

export async function getCategoryNames(): Promise<string[]> {
  console.log('getCategoryNames called');
  try {
    if (await shouldUseRemoteForCategories()) {
      // For now, use local even if remote is enabled since remote doesn't have this function yet
      return await local.getCategoryNames();
    } else {
      return await local.getCategoryNames();
    }
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
  try {
    let categoryId: string;
    if (await shouldUseRemoteForCategories()) {
      categoryId = await remote.addOrUpdateCategory(name, description, id);
    } else {
      categoryId = await local.addOrUpdateCategory(name, description, id);
    }
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: categoryId,
      tableName: 'Category',
      operation: id ? 'update' : 'create',
      timestamp: new Date(),
      uid,
    });
    return categoryId;
  } catch (error) {
    console.error('Error in addOrUpdateCategory:', error);
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  console.log('deleteCategory called with:', id);
  try {
    if (await shouldUseRemoteForCategories()) {
      await remote.deleteCategory(id);
    }
    await local.deleteCategory(id);
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
  if (await shouldUseRemote()) {
    await remote.deleteActivityLog(activityLogId);
  } else {
    await local.deleteActivityLog(activityLogId);
  }
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
  if (await shouldUseRemote()) {
    return await remote.createActivityLog(activityLog);
  } else {
    return await local.createActivityLog(activityLog);
  }
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
    if (await shouldUseRemote()) {
      await remote.updateActivityLogCategory(activityLogId, category);
    } else {
      await local.updateActivityLogCategory(activityLogId, category);
    }
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
    if (await shouldUseRemote()) {
      await remote.createRuleCandidate(data);
    } else {
      await local.createRuleCandidate(data);
    }
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
  // Tables to sync
  const tables = ['ActivityLog', 'Discussion'];
  for (const tableName of tables) {
    // 1. Get all local changelog rowIds for this table
    let localChangeLog: any[] = [];
    try {
      localChangeLog = await local.readChangeLog({ tableName });
    } catch (e) {
      console.warn(
        `[SYNC] Could not read local changelog for ${tableName}:`,
        e
      );
    }
    const localChangeLogRowIds = new Set(
      (localChangeLog || []).map((cl: any) => cl.rowId?.toString())
    );

    // 2. Download legacy/unsynced remote rows and create remote changelog entries
    let newRows: any[] = [];
    let changelogEntries: any[] = [];
    try {
      const result = await remote.downloadLegacyRowsAndSyncChangelog(
        tableName,
        localChangeLogRowIds
      );
      newRows = result.newRows;
      changelogEntries = result.changelogEntries;
    } catch (e) {
      console.warn(
        `[SYNC] Could not download legacy rows for ${tableName}:`,
        e
      );
    }

    // 3. Insert newRows into Realm
    console.log(`[SYNC] Inserting ${newRows.length} new rows for ${tableName}`);
    if (newRows && newRows.length > 0) {
      try {
        await local.syncTableFromRemote(tableName, newRows);
      } catch (e) {
        console.warn(`[SYNC] Could not insert newRows for ${tableName}:`, e);
      }
    }

    // 4. Add local changelog entries for each new row if not present
    if (newRows && newRows.length > 0) {
      for (const row of newRows) {
        const rowId = row.id?.toString();
        if (!localChangeLogRowIds.has(rowId)) {
          try {
            local.logChange(tableName, rowId, 'create');
          } catch (e) {
            console.warn(
              `[SYNC] Could not add local changelog for ${tableName} row ${rowId}:`,
              e
            );
          }
        }
      }
    }
  }
}

export { syncTableFromRemote } from './dbServicesLocal';

/**
 * Utility: Run all sync functions (Discussions, ActivityLog, Categories, and full remote sync)
 */
export async function runAllSyncFunctions(appVersion = '1.1.0') {
  // console.log('[UTIL] Running all sync functions...');
  await synchronizeDiscussions(appVersion);
  await synchronizeActivityLog(appVersion);
  await synchronizeCategories(appVersion);
  await syncFromRemote();
  console.log('[UTIL] All sync functions complete.');
}

/**
 * Utility: Delete all rows in local Discussion, ActivityLog, ChangeLog, and all rows in Firebase changelog
 */
export async function deleteAllLocalAndRemoteRows() {
  console.log('[UTIL] Deleting all local and remote rows...');
  await local.deleteAllLocalRows();
  await remote.deleteAllRemoteChangeLogs();
  console.log('[UTIL] All local and remote rows deleted.');
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
    await local.createActivityLog({
      discussionId: `test-discussion-${i + 1}`,
      category: 'test',
      description: `Test ActivityLog ${i + 1}`,
      timestamp: new Date(),
      cleared: false,
      responseType: 'test',
      synced: false,
      uid: 'local_user',
      lockedCategory: false,
      lockedDescription: false,
    });
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
    const activityLogs = await getActivityLogs();
    console.log(`[UTIL] Found ${activityLogs.length} activity logs`);

    // Extract distinct categories (excluding empty, null, undefined, and 'uncategorized')
    const distinctCategories = new Set<string>();

    activityLogs.forEach((log: any) => {
      const category = log.category?.trim();
      if (
        category &&
        category !== 'uncategorized' &&
        category !== 'undefined' &&
        category !== 'null' &&
        category.length > 0
      ) {
        distinctCategories.add(category);
      }
    });

    console.log(
      `[UTIL] Found ${distinctCategories.size} distinct categories:`,
      Array.from(distinctCategories)
    );

    // Check existing categories to avoid duplicates
    const existingCategories = await getCategories();
    const existingCategoryNames = new Set(
      existingCategories.map((cat) => cat.name.toLowerCase())
    );

    let createdCount = 0;
    let skippedCount = 0;

    // Create categories that don't already exist
    for (const categoryName of distinctCategories) {
      const lowerCaseName = categoryName.toLowerCase();

      if (existingCategoryNames.has(lowerCaseName)) {
        console.log(
          `[UTIL] Category '${categoryName}' already exists, skipping`
        );
        skippedCount++;
      } else {
        try {
          await addOrUpdateCategory(
            categoryName,
            `Auto-created from ActivityLog data`
          );
          console.log(`[UTIL] Created category: ${categoryName}`);
          createdCount++;
        } catch (error) {
          console.warn(
            `[UTIL] Failed to create category '${categoryName}':`,
            error
          );
        }
      }
    }

    console.log(
      `[UTIL] Categories creation complete. Created: ${createdCount}, Skipped: ${skippedCount}`
    );
    return {
      total: distinctCategories.size,
      created: createdCount,
      skipped: skippedCount,
      categories: Array.from(distinctCategories),
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
    await local.addChangeLogEntry(tableName, rowId, operation, timestamp);
  } catch (error) {
    console.error('Error in addChangeLogEntry:', error);
    throw error;
  }
}

export async function importLegacyDiscussions(
  discussions: any[]
): Promise<number> {
  console.log(
    'importLegacyDiscussions called with:',
    discussions.length,
    'discussions'
  );
  try {
    return await local.importLegacyDiscussions(discussions);
  } catch (error) {
    console.error('Error in importLegacyDiscussions:', error);
    throw error;
  }
}

export async function importLegacyActivityLogs(
  activityLogs: any[]
): Promise<number> {
  console.log(
    'importLegacyActivityLogs called with:',
    activityLogs.length,
    'activity logs'
  );
  try {
    return await local.importLegacyActivityLogs(activityLogs);
  } catch (error) {
    console.error('Error in importLegacyActivityLogs:', error);
    throw error;
  }
}

export async function ensureStringIds(tableName: string): Promise<void> {
  console.log('ensureStringIds called for:', tableName);
  try {
    await local.ensureStringIds(tableName);
  } catch (error) {
    console.error('Error in ensureStringIds:', error);
    throw error;
  }
}

export async function printAllRealmDataToTerminal(): Promise<void> {
  console.log('printAllRealmDataToTerminal called');
  try {
    await local.printAllRealmDataToTerminal();
  } catch (error) {
    console.error('Error in printAllRealmDataToTerminal:', error);
    throw error;
  }
}

export async function debugPrintAllActivityLogs(): Promise<void> {
  console.log('debugPrintAllActivityLogs called');
  try {
    await local.debugPrintAllActivityLogs();
  } catch (error) {
    console.error('Error in debugPrintAllActivityLogs:', error);
    throw error;
  }
}

export async function debugPrintAllDiscussions(): Promise<void> {
  console.log('debugPrintAllDiscussions called');
  try {
    await local.debugPrintAllDiscussions();
  } catch (error) {
    console.error('Error in debugPrintAllDiscussions:', error);
    throw error;
  }
}

export async function removeDuplicateActivityLogs(): Promise<{
  duplicatesFound: number;
  duplicatesRemoved: number;
}> {
  console.log('removeDuplicateActivityLogs called');
  try {
    return await local.removeDuplicateActivityLogs();
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
    const activityLogs = await local.getActivityLogs();
    console.log('[DEBUG] Local getActivityLogs returned:', activityLogs.length, 'items');

    console.log('[DEBUG] Testing getDiscussions...');
    const discussions = await local.getDiscussions();
    console.log('[DEBUG] Local getDiscussions returned:', discussions.length, 'items');

    console.log('[DEBUG] Testing getCategories...');
    const categories = await local.getCategories();
    console.log('[DEBUG] Local getCategories returned:', categories.length, 'items');

    console.log('[DEBUG] Testing shouldUseRemote...');
    const useRemote = await shouldUseRemote();
    console.log('[DEBUG] shouldUseRemote returned:', useRemote);

    console.log('[DEBUG] Testing shouldUseRemoteForCategories...');
    const useRemoteCategories = await shouldUseRemoteForCategories();
    console.log('[DEBUG] shouldUseRemoteForCategories returned:', useRemoteCategories);

  } catch (error) {
    console.error('[DEBUG] Error in debugTestDataFetch:', error);
  }
}
