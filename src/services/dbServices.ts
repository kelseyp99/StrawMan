// src/services/dbServices.ts
import * as remote from './dbServicesRemote';
import * as local from './dbServicesLocal';
import { getUID } from '../utils/uidManager';
import { ActivityLog } from './types';

const USE_REMOTE = false;

interface Discussion {
  id: string;
  discussionId?: string;
  description: string;
  timestamp: Date | string;
  typeSay?: string;
  cleared: boolean;
  uid?: string;
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
  //console.log('isPaidUser called');
  // return local.isPaidUser();
  return false; // TODO: Implement or update as needed
}

export const findDuplicateActivityLog = async (
  discussionId: string,
  category: string,
  description: string,
  uid: string // keep for remote, but not for local
): Promise<ActivityLog | null> => {
  console.log('findDuplicateActivityLog called');
  try {
    const uidVal = (await getUID()) || 'unknown';
    if (USE_REMOTE) {
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
  id?: string,
  useRemote: boolean = USE_REMOTE
): Promise<string> {
  console.log(
    '[DISCUSSION] addOrUpdateDiscussion called with:',
    description,
    typeSay,
    id
  );
  try {
    let result: string;

    if (useRemote) {
      console.log('[DISCUSSION] Calling remote.addOrUpdateDiscussion');
      result = await remote.addOrUpdateDiscussion(
        description,
        typeSay,
        id as string
      );
    } else {
      console.log('[DISCUSSION] Calling local.addOrUpdateDiscussion');
      await local.initializeUser(); // Ensure user is initialized for local operations
      result = await local.addOrUpdateDiscussion(description, typeSay, id);
    }

    console.log('[DISCUSSION] Operation completed, logging SyncEntry');
    if (useRemote || (await isPaidUser())) {
      const uid = (await getUID()) || 'unknown';
      await logSyncEntry({
        id: result,
        tableName: 'Discussion',
        operation: id ? 'update' : 'create',
        timestamp: new Date(),
        uid,
      });
      console.log('[DISCUSSION] SyncEntry logged for ID:', result);
    }

    console.log('[DISCUSSION] Returning result:', result);
    return result;
  } catch (error) {
    console.error('[DISCUSSION] Error in addOrUpdateDiscussion:', error);
    console.error(
      '[DISCUSSION] Error details:',
      error instanceof Error ? error.message : String(error)
    );
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
    const result = USE_REMOTE
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
    const result = USE_REMOTE
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
    await remote.processPendingTells();
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
    const remoteResult = await remote.addQuestionDiscussion(
      question,
      discussionId
    );
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
    await remote.processUnclearedGPTResponses();
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
    await remote.markDiscussionAsCleared(discussionId);
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
    const remoteResult = await remote.clearDiscussion(discussionId);
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
    await remote.addOrUpdateActivityLog();
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
    await remote.renameFieldToCleared();
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
  payload?: any,
  method?: 'POST' | 'PUT' | 'DELETE'
): Promise<void> {
  if (payload && method) {
    // Single-record sync
    console.log('syncToCloud (single-record) called with:', tableName, method);
    try {
      // Router-based upload to Firestore for a single record
      await remote.syncRealmRowsToFirestore(tableName, [payload]);
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
    await remote.deactivateAlertByKey(keyStr);
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

export async function getParameters(): Promise<any[]> {
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

// Delete ActivityLog (router)
export async function deleteActivityLog(activityLogId: string): Promise<void> {
  if (USE_REMOTE) {
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
  console.log('createRuleCandidate called with:', data);
  try {
    if (USE_REMOTE) {
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
      localChangeLog = local.readChangeLog({ tableName });
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
 * Utility: Run all sync functions (Discussions, ActivityLog, and full remote sync)
 */
export async function runAllSyncFunctions(appVersion = '1.1.0') {
  console.log('[UTIL] Running all sync functions...');
  await synchronizeDiscussions(appVersion);
  await synchronizeActivityLog(appVersion);
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
    await addOrUpdateDiscussion(
      `Test Discussion ${i + 1}`,
      'test',
      undefined,
      false
    );
    await local.createActivityLog({
      discussionId: `test-discussion-${i + 1}`,
      category: 'test',
      description: `Test ActivityLog ${i + 1}`,
      timestamp: new Date(),
      cleared: false,
      responseType: 'test',
      synced: false,
    });
  }
  console.log('[UTIL] Test rows inserted. Exiting process.');
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(0);
  }
}
