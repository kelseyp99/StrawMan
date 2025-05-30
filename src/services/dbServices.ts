// src/services/dbServices.ts
import * as remote from './dbServicesRemote';
import * as local from './dbServicesLocal';
import { getUID } from '../utils/uidManager';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ActivityLog, Parameters } from './dbServicesLocal';

const USE_REMOTE = true;

interface Discussion {
  id: number;
  discussionId?: number;
  description: string;
  timestamp: Date | string;
  typeSay?: string;
  cleared: boolean;
  uid?: string;
}

export interface IActivityLog {
  id: number;
  discussionId: number;
  category: string;
  description: string;
  timestamp: Date;
  cleared: boolean;
  responseType?: string;
  uid: string;
  synced: boolean;
  syncTimestamp?: Date;
}

interface SyncEntry {
  id: number;
  tableName: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: Date;
  uid: string;
}

async function logSyncEntry(entry: SyncEntry): Promise<void> {
  try {
    // Log to Realm via dbServicesLocal.ts
    await local.logSyncEntry(entry);

    // Log to Firestore for paid users
    if (await isPaidUser()) {
      await addDoc(collection(db, `Users/${entry.uid}/SyncEntry`), {
        id: entry.id,
        tableName: entry.tableName,
        operation: entry.operation,
        timestamp: entry.timestamp,
        uid: entry.uid,
      });
      console.log('Logged SyncEntry to Firestore:', entry);
    }
  } catch (error) {
    console.error('Error logging SyncEntry:', error);
  }
}

export async function isPaidUser(): Promise<boolean> {
  console.log('isPaidUser called');
  return local.isPaidUser();
}
//

export const findDuplicateActivityLog = async (
  discussionId: string,
  category: string,
  description: string,
  uid: string
): Promise<IActivityLog | null> => {
  console.log('findDuplicateActivityLog called');
  try {
    const uid = (await getUID()) || 'unknown';
    if (USE_REMOTE) {
      await remote.findDuplicateActivityLog(
        discussionId,
        category,
        description,
        uid
      );
    } else {
      await local.findDuplicateActivityLog(
        discussionId,
        category,
        description,
        uid
      );
    }
    return null; // Add a return statement here
  } catch (error) {
    console.error('Error in initializeUser:', error);
    throw error;
  }
};

export async function initializeUser(): Promise<void> {
  console.log('initializeUser called');
  try {
    if (USE_REMOTE) {
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
  id?: string | number
): Promise<string> {
  console.log('addOrUpdateDiscussion called with:', description, typeSay, id);
  try {
    const numericId = id ? Number(id) : undefined;
    const remoteResult = await remote.addOrUpdateDiscussion(
      description,
      typeSay,
      id as string
    );
    await local.addOrUpdateDiscussion(
      description,
      typeSay,
      numericId || Number(remoteResult)
    );
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(remoteResult),
      tableName: 'Discussion',
      operation: id ? 'update' : 'create',
      timestamp: new Date(),
      uid,
    });
    return remoteResult;
  } catch (error) {
    console.error('Error in addOrUpdateDiscussion:', error);
    throw error;
  }
}

export async function getDiscussions(
  lastX?: number,
  discussionId?: string
): Promise<any[]> {
  console.log(
    'getDiscussions called with lastX:',
    lastX,
    'discussionId:',
    discussionId
  );
  try {
    const result = USE_REMOTE
      ? await remote.getDiscussions(lastX, discussionId)
      : await local.getDiscussions(lastX, discussionId);
    console.log('getDiscussions result:', result);
    return result;
  } catch (error) {
    console.error('getDiscussions error:', error);
    return [];
  }
}

export async function deleteDiscussion(id: string): Promise<void> {
  console.log('deleteDiscussion called with:', id);
  try {
    await remote.deleteDiscussion(id);
    await local.deleteDiscussion(Number(id));
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(id),
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
    const result = USE_REMOTE
      ? await remote.fetchInitialDiscussion()
      : await local.fetchInitialDiscussion();
    return result;
  } catch (error) {
    console.error('Error in fetchInitialDiscussion:', error);
    return null;
  }
}

export async function getNextOpenDiscussion(lastVisibleId?: number): Promise<{
  snapshot: any;
  hasMore: boolean;
  lastVisibleDoc: any;
}> {
  console.log('getNextOpenDiscussion called with:', lastVisibleId);
  try {
    const result = USE_REMOTE
      ? await remote.getNextOpenDiscussion(lastVisibleId)
      : await local.getNextOpenDiscussion(lastVisibleId);
    return result;
  } catch (error) {
    console.error('Error in getNextOpenDiscussion:', error);
    return { snapshot: [], hasMore: false, lastVisibleDoc: null };
  }
}

export async function processPendingTells(): Promise<void> {
  console.log('processPendingTells called');
  try {
    await remote.processPendingTells();
    await local.processPendingTells();
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime(),
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
    const remoteResult = await remote.addQuestionDiscussion(
      question,
      discussionId
    );
    await local.addQuestionDiscussion(question, discussionId);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(remoteResult),
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
    await remote.processUnclearedGPTResponses();
    await local.processUnclearedGPTResponses();
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime(),
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
    await remote.markDiscussionAsCleared(discussionId);
    await local.markDiscussionAsCleared(discussionId);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(discussionId),
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
    const remoteResult = await remote.clearDiscussion(discussionId);
    const localResult = await local.clearDiscussion(discussionId);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(discussionId),
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
    await remote.addOrUpdateActivityLog();
    await local.addOrUpdateActivityLog();
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime(),
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
    await remote.renameFieldToCleared();
    await local.renameFieldToCleared();
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime(),
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
    const result = USE_REMOTE
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
    const result = USE_REMOTE
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
    await remote.addOrUpdateGPTResponse(
      discussionId,
      response,
      responseType,
      cleared
    );
    await local.addOrUpdateGPTResponse(
      discussionId,
      response,
      responseType,
      cleared
    );
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime(),
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
    const result = USE_REMOTE
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
    const result = USE_REMOTE
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
    const result = USE_REMOTE
      ? await remote.getAIResponse(question)
      : await local.getAIResponse(question);
    return result;
  } catch (error) {
    console.error('Error in getAIResponse:', error);
    throw error;
  }
}

export async function syncToCloud(
  tableName: string,
  payload: any,
  method: 'POST' | 'PUT' | 'DELETE'
): Promise<void> {
  console.log('syncToCloud called with:', tableName, method);
  try {
    await remote.syncToCloud(tableName, payload, method);
    await local.syncToCloud(tableName, payload, method);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(payload.id) || new Date().getTime(),
      tableName,
      operation:
        method === 'POST' ? 'create' : method === 'PUT' ? 'update' : 'delete',
      timestamp: new Date(),
      uid,
    });
  } catch (error) {
    console.error('Error in syncToCloud:', error);
    throw error;
  }
}

export async function getNextActiveAlert(): Promise<any | null> {
  console.log('getNextActiveAlert called');
  try {
    const result = USE_REMOTE
      ? await remote.getNextActiveAlert()
      : await local.getNextActiveAlert();
    return result;
  } catch (error) {
    console.error('Error in getNextActiveAlert:', error);
    return null;
  }
}

export async function addOrUpdateAlert(alertData: any): Promise<void> {
  console.log('addOrUpdateAlert called with:', alertData);
  try {
    await remote.addOrUpdateAlert(alertData);
    await local.addOrUpdateAlert(alertData);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: alertData._id || new Date().getTime(),
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

export async function deactivateAlertByKey(key: number): Promise<void> {
  console.log('deactivateAlertByKey called with:', key);
  try {
    await remote.deactivateAlertByKey(key);
    await local.deactivateAlertByKey(key);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: key,
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
    const result = USE_REMOTE
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
  console.log('expandFromAbbreviation called with:', discussion);
  try {
    const result = USE_REMOTE
      ? await remote.expandFromAbbreviation(discussion)
      : await local.expandFromAbbreviation(discussion);
    return result;
  } catch (error) {
    console.error('Error in expandFromAbbreviation:', error);
    return discussion;
  }
}

export async function restoreLostData(): Promise<void> {
  console.log('restoreLostData called');
  try {
    await remote.restoreLostData();
    await local.restoreLostData();
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime(),
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
  console.log('getRules called');
  try {
    const result = USE_REMOTE
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
  console.log('updateGPTSpecialties called with:', gptSpecialty);
  try {
    await remote.updateGPTSpecialties(gptSpecialty);
    await local.updateGPTSpecialties(gptSpecialty);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: gptSpecialty.id || new Date().getTime(),
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
  console.log('getActivityLogs called');
  try {
    const result = USE_REMOTE
      ? await remote.getActivityLogs()
      : await local.getActivityLogs();
    return result;
  } catch (error) {
    console.error('Error in getActivityLogs:', error);
    return [];
  }
}

export async function getParameters(): Promise<Parameters[]> {
  console.log('getParameters called');
  try {
    const result = USE_REMOTE
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
    const result = USE_REMOTE
      ? await remote.getDescriptionsWithTimestamps(categories)
      : await local.getDescriptionsWithTimestamps(categories);
    return result;
  } catch (error) {
    console.error('Error in getDescriptionsWithTimestamps:', error);
    return '[]';
  }
}

export async function createDocument(data: any): Promise<string> {
  console.log('createDocument called with:', data);
  try {
    const remoteResult = await remote.createDocument(data);
    await local.createDocument(data);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(remoteResult),
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
  console.log('readDocuments called');
  try {
    const result = USE_REMOTE
      ? await remote.readDocuments()
      : await local.readDocuments();
    return result;
  } catch (error) {
    console.error('Error in readDocuments:', error);
    return [];
  }
}

export async function updateDocument(docId: string, data: any): Promise<void> {
  console.log('updateDocument called with:', docId, data);
  try {
    await remote.updateDocument(docId, data);
    await local.updateDocument(docId, data);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(docId),
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
      id: Number(docId),
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
  console.log('getDistinctCategories called');
  try {
    const result = USE_REMOTE
      ? await remote.getDistinctCategories()
      : await local.getDistinctCategories();
    return result;
  } catch (error) {
    console.error('Error in getDistinctCategories:', error);
    return [];
  }
}

export async function insertJsonFile(jsonData: any): Promise<void> {
  console.log('insertJsonFile called with:', jsonData);
  try {
    await remote.insertJsonFile(jsonData);
    await local.insertJsonFile(jsonData);
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime(),
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
    const result = USE_REMOTE
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
      id: new Date().getTime(),
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
      id: new Date().getTime(),
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

// Delete ActivityLog (router)
export async function deleteActivityLog(activityLogId: string): Promise<void> {
  if (USE_REMOTE) {
    await remote.deleteActivityLog(activityLogId);
  } else {
    await local.deleteActivityLog(activityLogId);
  }
  const uid = (await getUID()) || 'unknown';
  await logSyncEntry({
    id: Number(activityLogId),
    tableName: 'ActivityLog',
    operation: 'delete',
    timestamp: new Date(),
    uid,
  });
}

// Create ActivityLog (router)
export async function createActivityLog(
  activityLog: Omit<IActivityLog, 'id'>
): Promise<string> {
  if (USE_REMOTE) {
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
    if (USE_REMOTE) {
      await remote.updateActivityLogCategory(activityLogId, category);
    } else {
      await local.updateActivityLogCategory(activityLogId, category);
    }
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: Number(activityLogId),
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
  console.log('createRuleCandidate called with:', data);
  try {
    if (USE_REMOTE) {
      await remote.createRuleCandidate(data);
    } else {
      await local.createRuleCandidate(data);
    }
    const uid = (await getUID()) || 'unknown';
    await logSyncEntry({
      id: new Date().getTime(),
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
