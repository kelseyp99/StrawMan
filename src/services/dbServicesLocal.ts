import Realm from 'realm';
import axios from 'axios';
import {
  realm,
  GPTResponsesSchema,
  GPTSpecialtiesSchema,
  ActivityLogSchema,
  DiscussionSchema,
  AlertSchema,
  ParametersSchema,
} from '../realmConfig';
import { sendQuestion, sendQuestionForParsing } from './openaiAPI';
// import { getUID } from '../utils/uidManager';
import { format } from 'date-fns';
import { IActivityLog } from './dbServices';

const APP_VERSION = '1.1.0';
const APP_ID = 'com.anonymous.lifelog';

// Toggle for synchronization
const ENABLE_DISCUSSION_SYNC = false;
const ENABLE_ACTIVITYLOG_SYNC = false;

// Interfaces matching realmConfig.ts schemas
interface User {
  id: string;
  appVersion: string;
  appId: string;
  timestamp: Date;
  isPaid: boolean;
}

export interface ActivityLog {
  id: number;
  discussionId: number;
  category: string;
  description: string;
  timestamp: Date;
  cleared: boolean;
  responseType?: string;
  synced: boolean;
  syncTimestamp?: Date;
}

interface Discussion {
  id: number;
  discussionId: number;
  description: string;
  timestamp: Date;
  typeSay: string;
  cleared: boolean;
  synced: boolean;
  syncTimestamp: Date;
}

export interface Parameters {
  parameterName: string;
  parameterValue?: string;
}

interface Rule {
  pattern: string;
  isRegex: boolean;
  category: string;
  priority: number;
}

interface GPTSpecialty {
  id: number;
  name: string;
  url: string;
  apiKey: string;
  synced?: boolean;
}

interface GPTResponse {
  id: number;
  discussionId: number;
  timestamp: Date;
  prompt: string;
  response: string;
  responseType: string;
  cleared: boolean;
  synced: boolean;
  syncTimestamp?: Date;
}

interface Alert {
  id: number;
  message: string;
  timestamp: Date;
  severity: string;
  isActive: boolean;
  nextTrigger: Date;
  createdAt: Date;
  synced: boolean;
  syncTimestamp?: Date;
}

interface DiscussionCloudPayload {
  DiscussionId: string;
  UserId?: string;
  description: string;
  Operation: string;
  typeSay?: string;
}

interface ActivityLogCloudPayload {
  DiscussionId: string;
  UserId?: string;
  description: string;
  Operation: string;
  typeSay?: string;
  cleared: boolean;
  id: number;
  category: string;
  timestamp: Date;
}

interface CloudPayload {
  timestamp: Date;
  id: string;
  description: string;
  Operation: string;
  typeSay?: string;
  [key: string]: any;
}

interface LastOpenDiscussion {
  id: string;
  description: string;
}

// src/services/dbServicesLocal.ts
// ... existing imports and interfaces ...
//import Realm from 'realm';

interface SyncEntry {
  id: number;
  tableName: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: Date;
}

export const findDuplicateActivityLog = (
  discussionId: string,
  category: string,
  description: string
): IActivityLog | null => {
  if (!realm) throw new Error('Realm not initialized');
  console.log(
    `Checking for duplicate ActivityLog: ${discussionId}, ${category}`
  );

  try {
    const logs = realm
      ?.objects<IActivityLog>('ActivityLog')
      .filtered(
        'discussionId == $0 AND category == $1 AND description == $2',
        discussionId,
        category,
        description
      );

    if (!logs || logs.length === 0) {
      console.log('No duplicate ActivityLog found');
      return null;
    }

    const log = logs[0];
    console.log(`Found duplicate ActivityLog: ${log.id}`);
    return {
      id: log.id,
      discussionId: log.discussionId,
      category: log.category,
      description: log.description,
      timestamp: log.timestamp,
      cleared: log.cleared,
      responseType: log.responseType,
      synced: log.synced,
      syncTimestamp: log.syncTimestamp,
    } as IActivityLog;
  } catch (error) {
    console.error('Error finding duplicate ActivityLog:', error);
    throw error;
  }
};

export async function logSyncEntry(entry: SyncEntry): Promise<void> {
  if (!realm) {
    console.warn('Realm not initialized, skipping SyncEntry log');
    return;
  }
  try {
    realm?.write(() => {
      realm?.create('SyncEntry', {
        id: entry.id,
        tableName: entry.tableName,
        operation: entry.operation,
        timestamp: entry.timestamp,
      });
    });
    console.log('Logged SyncEntry to Realm:', entry);
  } catch (error) {
    console.error('Error logging SyncEntry to Realm:', error);
    throw error;
  }
}

export async function initializeUser(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm?.write(() => {
      // Removed  logic
      const userData = {
        id: 'local_user',
        appVersion: APP_VERSION,
        appId: APP_ID,
        timestamp: new Date(),
        isPaid: false, // Update based on subscription check
      };
      const existingUser = realm?.objects<User>('User')[0];
      if (existingUser) {
        Object.assign(existingUser, userData);
      } else {
        realm?.create('User', userData);
      }
    });
    console.log('User initialized successfully');
  } catch (error) {
    console.error('Error initializing user:', error);
    throw error;
  }
}

export async function createDocument(data: any): Promise<string> {
  if (!realm) throw new Error('Realm not initialized');
  try {
    const id = new Date().getTime();
    realm?.write(() => {
      realm?.create('Document', {
        id,
        ...data,
        timestamp: new Date(),
        synced: false,
      });
    });
    console.log('Document created with ID:', id);
    return id.toString();
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
}

export async function readDocuments(): Promise<any[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const documents =
      realm?.objects('Document')?.map((doc) => ({ id: doc.id, ...doc })) ?? [];
    console.log('Documents retrieved:', documents);
    return documents;
  } catch (error) {
    console.error('Error reading documents:', error);
    throw error;
  }
}

export async function updateDocument(docId: string, data: any): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm?.write(() => {
      const doc = realm?.objectForPrimaryKey('Document', Number(docId));
      if (doc) {
        Object.assign(doc, { ...data, synced: false });
        console.log('Document updated with ID:', docId);
      }
    });
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm?.write(() => {
      const doc = realm?.objectForPrimaryKey('Document', Number(docId));
      if (doc) {
        realm?.delete(doc);
        console.log('Document deleted with ID:', docId);
      }
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}

export async function getDistinctCategories(): Promise<string[]> {
  console.log('Getting distinct categories...');
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const categories = Array.from(
      new Set(
        realm?.objects<ActivityLog>('ActivityLog')?.map((item) => item.category)
      )
    ).filter((cat) => cat !== 'uncategorized');
    if (categories.length === 0) {
      categories.push('diet');
    }
    console.log('Categories:', categories);
    return categories;
  } catch (error) {
    console.error('Error getting distinct categories:', error);
    return [];
  }
}

export async function insertJsonFile(jsonData: any): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm?.write(() => {
      jsonData.forEach((item: any) => {
        const id = new Date().getTime();
        realm?.create('ActivityLog', {
          id,
          discussionId: id,
          category: item.category,
          description: item.value,
          timestamp: new Date(),
          cleared: false,
          synced: false,
        });
      });
    });
    console.log('Data inserted successfully!');
  } catch (error) {
    console.error('Error inserting data:', error);
  }
}
export async function queryAllFieldsByCategories(
  categories: string[]
): Promise<string[]> {
  console.log('Querying all fields by categories:', categories);
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const results = realm
      .objects<ActivityLog>('ActivityLog')
      .filtered(
        'category IN $0',
        categories.length > 0 ? categories : ['uncategorized']
      );
    return results.map((log) => {
      const timestamp = new Date(log.timestamp);
      const formattedTimestamp = `${
        timestamp.getMonth() + 1
      }/${timestamp.getDate()}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      return `${formattedTimestamp} ${log.description}`;
    });
  } catch (error) {
    console.error('Error querying fields by categories:', error);
    return [];
  }
}

// Removed all  logic from synchronization functions
export async function synchronizeActivityLog(
  appVersion: string
): Promise<void> {
  if (!ENABLE_ACTIVITYLOG_SYNC) {
    console.log('ActivityLog synchronization disabled.');
    return;
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    console.log(`Synchronizing ActivityLog`);
    // Example: Just log, as  logic is removed
    console.log('ActivityLog synchronization completed.');
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
  if (!compareVersions(appVersion, '1.1.0')) {
    console.log('Skipping sync for version >= 1.1.0');
    return;
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    console.log(`Synchronizing Discussions`);
    // Example: Just log, as  logic is removed
    console.log('Discussion synchronization completed.');
  } catch (error) {
    console.error('Error synchronizing Discussions:', error);
    throw error;
  }
}

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

export async function addOrUpdateDiscussion(
  description: string,
  typeSay: string = 'tell',
  id?: number
): Promise<string> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    const currentTime = new Date();
    const discussionId = id || currentTime.getTime();
    const payload: DiscussionCloudPayload = {
      DiscussionId: discussionId.toString(),
      description,
      Operation: id ? 'update' : 'add',
      typeSay,
    };
    realmInstance.write(() => {
      const discussion = realmInstance.objectForPrimaryKey<Discussion>(
        'Discussion',
        discussionId
      );
      const discussionData = {
        id: discussionId,
        discussionId,
        description,
        typeSay,
        cleared: false,
        timestamp: currentTime,
        synced: false,
        syncTimestamp: currentTime,
      };
      if (discussion) {
        if (!description) {
          realmInstance.delete(discussion);
          payload.Operation = 'delete';
        } else {
          Object.assign(discussion, discussionData);
        }
      } else {
        realmInstance.create('Discussion', discussionData);
      }
    });
    await addOrUpdateDiscussionCloud(
      payload,
      id ? (description ? 'PUT' : 'DELETE') : 'POST'
    );
    console.log(
      `Discussion ${id ? 'updated' : 'added'} successfully: ${discussionId}`
    );
    return discussionId.toString();
  } catch (error) {
    console.error('Error adding/updating discussion:', error);
    throw error;
  }
}

async function addDiscussion(
  description: string,
  typeSay: string = 'tell'
): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    realmInstance.write(() => {
      const discussions = realmInstance
        .objects<Discussion>('Discussion')
        .filtered('description == null OR description == ""');
      if (realm) realm.delete(discussions);
    });
    const currentTime = new Date();
    const id = currentTime.getTime();
    const payload: DiscussionCloudPayload = {
      DiscussionId: id.toString(),
      description,
      Operation: 'add',
      typeSay,
    };
    realmInstance.write(() => {
      realmInstance.create('Discussion', {
        id,
        discussionId: id,
        timestamp: currentTime,
        description,
        cleared: false,
        typeSay,
        synced: false,
        syncTimestamp: currentTime,
      });
    });
    await addOrUpdateDiscussionCloud(payload, 'POST');
    console.log(`Discussion added successfully: ${id}`);
  } catch (error) {
    console.error('Error adding discussion:', error);
    throw error;
  }
}
async function addOrUpdateDiscussionCloud(
  payload: DiscussionCloudPayload,
  method: 'POST' | 'PUT' | 'DELETE'
): Promise<void> {
  const isOnline = true; // Simulate network check
  if (!isOnline) {
    console.log('Device is offline. Sync will be attempted later.');
    updateRealmDiscussionSyncStatus(Number(payload.DiscussionId), false);
    return;
  }
  const url = `${process.env.EXPO_PUBLIC_API_URL}discussion/`;
  try {
    const config = { headers: { 'Content-Type': 'application/json' } };
    let response;
    if (method === 'POST') {
      response = await axios.post(url, payload, config);
    } else if (method === 'PUT') {
      response = await axios.put(url, payload, config);
    } else if (method === 'DELETE') {
      response = await axios.delete(`${url}${payload.DiscussionId}`, config);
    }
    console.log('Discussion synced successfully:', response?.data);
    updateRealmDiscussionSyncStatus(Number(payload.DiscussionId), true);
  } catch (error) {
    console.error('Error syncing discussion to cloud:', error);
    updateRealmDiscussionSyncStatus(Number(payload.DiscussionId), false);
  }
}
const updateRealmDiscussionSyncStatus = (id: number, synced: boolean): void => {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const discussion = realm?.objectForPrimaryKey<Discussion>(
        'Discussion',
        id
      );
      if (discussion) {
        discussion.synced = synced;
        discussion.syncTimestamp = new Date();
      }
    });
  } catch (error) {
    console.error('Error updating Realm sync status:', error);
  }
};

export async function getDiscussions(
  lastX?: number,
  discussionId?: string
): Promise<any[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    let discussions = realmInstance
      .objects<Discussion>('Discussion')
      .sorted('timestamp', true);
    if (discussionId) {
      const discussion = realmInstance.objectForPrimaryKey<Discussion>(
        'Discussion',
        Number(discussionId)
      );
      if (discussion) {
        discussions = discussions.filtered(
          'timestamp < $0',
          discussion.timestamp
        );
      }
    }
    if (lastX !== undefined) {
      discussions = realm
        .objects<Discussion>('Discussion')
        .filtered(
          `id IN {${discussions
            .slice(0, lastX)
            .map((d) => d.id)
            .join(',')}}`
        )
        .sorted('timestamp', true);
    }
    return discussions.map((doc) => ({
      id: doc.id,
      discussionId: doc.discussionId,
      description: doc.description,
      typeSay: doc.typeSay,
      cleared: doc.cleared,
      timestamp: format(new Date(doc.timestamp), 'M/d/yy \n h:mm a'),
    }));
  } catch (error) {
    console.error('Error getting Discussions:', error);
    return [];
  }
}

export async function deleteDiscussion(id: number): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    realmInstance.write(() => {
      const discussion = realm?.objectForPrimaryKey<Discussion>(
        'Discussion',
        id
      );
      if (discussion && realm) {
        if (realm) realm.delete(discussion);
        console.log(`Discussion with ID ${id} deleted.`);
      }
    });
  } catch (error) {
    console.error(`Error deleting discussion with ID ${id}:`, error);
  }
}

export async function fetchInitialDiscussion(): Promise<any | null> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const discussions = realm
      .objects<Discussion>('Discussion')
      .sorted('timestamp', true);
    if (discussions.length > 0) {
      const doc = discussions[0];
      return {
        id: doc.id,
        discussionId: doc.discussionId || doc.id,
        description: doc.description,
        timestamp: new Date(),
        typeSay: doc.typeSay || 'ask',
        cleared: doc.cleared || false,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching initial discussion:', error);
    return null;
  }
}

export async function getNextOpenDiscussion(lastVisibleId?: number): Promise<{
  snapshot: any;
  hasMore: boolean;
  lastVisibleDoc: any;
}> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    let discussions = realm
      .objects<Discussion>('Discussion')
      .filtered('cleared == false AND typeSay == "ask"');
    if (lastVisibleId) {
      discussions = discussions.filtered('id < $0', lastVisibleId);
    }
    const snapshot = discussions.slice(0, 1);
    return {
      snapshot,
      hasMore: snapshot.length > 0,
      lastVisibleDoc: snapshot.length > 0 ? snapshot[0].id : null,
    };
  } catch (error) {
    console.error('Error fetching next open discussion:', error);
    return { snapshot: [], hasMore: false, lastVisibleDoc: null };
  }
}

export async function processPendingTells(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    const discussions = realm
      .objects<Discussion>('Discussion')
      .filtered('typeSay == "tell" AND cleared == false');
    if (discussions.length === 0) {
      console.log('No pending tell statements to process.');
      return;
    }
    const rules = await getRules();
    realmInstance.write(() => {
      discussions.forEach((doc) => {
        let category = 'uncategorized';
        for (const rule of rules) {
          if (rule.isRegex) {
            const pattern = new RegExp(rule.pattern, 'i');
            if (pattern.test(doc.description)) {
              category = rule.category;
              break;
            }
          } else if (
            doc.description.toLowerCase().includes(rule.pattern.toLowerCase())
          ) {
            category = rule.category;
            break;
          }
        }
        realmInstance.create('ActivityLog', {
          id: new Date().getTime(),
          discussionId: doc.id,
          description: doc.description,
          category,
          timestamp: doc.timestamp,
          cleared: false,
          synced: false,
        });
        doc.cleared = true;
        doc.synced = false;
      });
    });
    console.log('Finished processing pending tell statements.');
  } catch (error) {
    console.error('Error processing pending tells:', error);
    throw error;
  }
}
export async function addQuestionDiscussion(
  question: string,
  discussionId: string
): Promise<string> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    await addOrUpdateDiscussion(question, 'ask', Number(discussionId));
    const gpts_names = ['openAI', 'Gemini', 'ChatGPT', 'Claude', 'DeepSeek'];
    const categories = await getDistinctCategories();
    const response = await sendQuestionForParsing({
      categories,
      gpts_names,
      question,
      discussionId,
    });
    const id = new Date().getTime();
    realmInstance.write(() => {
      realmInstance.create('GPTResponses', {
        id,
        discussionId: Number(discussionId),
        timestamp: new Date(),
        prompt: question,
        response: JSON.stringify(response),
        responseType: 'parsed question',
        cleared: false,
        synced: false,
      });
    });
    return id.toString();
  } catch (error) {
    console.error('Error adding question discussion:', error);
    throw error;
  }
}

export async function processUnclearedGPTResponses(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    let hasMore = true;
    while (hasMore) {
      const responses = realm
        .objects<GPTResponse>('GPTResponses')
        .filtered('cleared == false AND responseType == "updateDB"')
        .slice(0, 1);
      if (responses.length === 0) {
        hasMore = false;
        break;
      }
      const gptResponse = responses[0];
      const responseJson = JSON.parse(gptResponse.response) as {
        category: string;
        parsedDescription: string;
      };
      const discussionId = gptResponse.discussionId;
      const timestamp = new Date(gptResponse.timestamp);
      const activityLog = realm
        ?.objects<ActivityLog>('ActivityLog')
        .filtered('discussionId == $0', discussionId)[0];
      const realmInstance = realm;
      realmInstance?.write(() => {
        if (activityLog) {
          activityLog.category = responseJson.category;
          activityLog.description = responseJson.parsedDescription;
          activityLog.responseType = 'tell';
          activityLog.cleared = true;
          activityLog.synced = false;
        } else {
          realmInstance?.create('ActivityLog', {
            id: new Date().getTime(),
            discussionId,
            category: responseJson.category,
            description: responseJson.parsedDescription,
            timestamp,
            cleared: true,
            synced: false,
          });
        }
        gptResponse.cleared = true;
        gptResponse.synced = false;
      });
      const success = await clearDiscussion(String(discussionId));
      if (!success) {
        console.error('Failed to clear discussion. Exiting process.');
        return;
      }
    }
    console.log('All GPTResponses have been cleared.');
  } catch (error) {
    console.error('Error processing uncleared GPT responses:', error);
  }
}

export async function markDiscussionAsCleared(
  discussionId: string
): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    realmInstance.write(() => {
      const discussion = realmInstance.objectForPrimaryKey<Discussion>(
        'Discussion',
        Number(discussionId)
      );
      if (discussion) {
        discussion.cleared = true;
        discussion.synced = false;
        console.log(`Discussion ${discussionId} marked as cleared.`);
      }
    });
  } catch (error) {
    console.error('Error marking discussion as cleared:', error);
  }
}

export async function clearDiscussion(discussionId: string): Promise<boolean> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    realmInstance.write(() => {
      const discussion = realmInstance.objectForPrimaryKey<Discussion>(
        'Discussion',
        Number(discussionId)
      );
      if (discussion) {
        discussion.cleared = true;
        discussion.synced = false;
        console.log(`Processed and cleared Discussion: ${discussionId}`);
      }
    });
    return true;
  } catch (error) {
    console.error(`Error clearing discussion ${discussionId}:`, error);
    return false;
  }
}

interface GPTResponseJSONData {
  category: string;
  parsedDescription: string;
}

export async function addOrUpdateActivityLog(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    const responses = realmInstance
      .objects<GPTResponse>('GPTResponses')
      .filtered('cleared == false AND responseType == "updateDB"');
    for (const gptResponse of responses) {
      const responseJson = JSON.parse(
        gptResponse.response
      ) as GPTResponseJSONData;
      const timestampValue = gptResponse.timestamp;
      const timestamp =
        timestampValue instanceof Date
          ? timestampValue
          : typeof timestampValue === 'string' ||
            typeof timestampValue === 'number'
          ? new Date(timestampValue)
          : new Date();
      if (isNaN(timestamp.getTime())) {
        console.warn(
          `Invalid timestamp for GPTResponse ${gptResponse.id}, using current date`
        );
        timestamp.setTime(Date.now());
      }
      const category = responseJson.category;
      const parsedDescription = responseJson.parsedDescription;
      const discussionId = gptResponse.discussionId;
      const activityLog = realmInstance
        .objects<ActivityLog>('ActivityLog')
        .filtered('discussionId == $0', discussionId)[0];
      realmInstance.write(() => {
        if (activityLog) {
          activityLog.category = category;
          activityLog.description = parsedDescription;
          activityLog.responseType = 'tell';
          activityLog.cleared = true;
          activityLog.synced = false;
        } else {
          realmInstance.create('ActivityLog', {
            id: new Date().getTime(),
            discussionId,
            category,
            description: parsedDescription,
            timestamp,
            cleared: true,
            synced: false,
          });
        }
        gptResponse.cleared = true;
        gptResponse.synced = false;
      });
    }
  } catch (error) {
    console.error('Error adding or updating ActivityLog:', error);
  }
}

export async function renameFieldToCleared(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const realmInstance = realm;
      const discussions = realmInstance?.objects<Discussion>('Discussion');
      discussions?.forEach((doc) => {
        const fieldName = Object.keys(doc).find(
          (key) => key.toLowerCase() === 'cleared'
        );
        if (fieldName && fieldName !== 'cleared') {
          doc.cleared = (doc as any)[fieldName];
          delete (doc as any)[fieldName];
          doc.synced = false;
        }
      });
    });
    console.log('All discussions updated successfully!');
  } catch (error) {
    console.error('Error updating discussions:', error);
  }
}

export async function getLastOpenDiscussion(): Promise<LastOpenDiscussion> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const discussions = realm
      .objects<Discussion>('Discussion')
      .filtered(
        'cleared == false AND description != null AND description != ""'
      )
      .sorted('timestamp', true);
    if (discussions.length > 0) {
      const discussion = discussions[0];
      return {
        id: String(discussion.id),
        description: discussion.description,
      };
    }
    throw new Error('No open discussions found');
  } catch (error) {
    console.error('Error getting last open discussion:', error);
    throw error;
  }
}

export async function disperseQuestion(
  discussionId: string,
  GPT_ResponseId: string
): Promise<string[] | undefined> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    const discussion = realmInstance.objectForPrimaryKey<Discussion>(
      'Discussion',
      Number(discussionId)
    );
    if (!discussion) {
      console.log(`No discussion found with ID: ${discussionId}`);
      return undefined;
    }
    const gptResponse = realmInstance.objectForPrimaryKey<GPTResponse>(
      'GPTResponses',
      Number(GPT_ResponseId)
    );
    if (!gptResponse) {
      console.error('GPT Response not found');
      return undefined;
    }
    const parsedQuestion = JSON.parse(gptResponse.response) as {
      parts: { category: string; gpt: string; parsedDescription: string }[];
    };
    const responses: string[] = [];
    for (const part of parsedQuestion.parts) {
      const { gpt, category, parsedDescription: question } = part;
      const response = await sendQuestion({
        category,
        gpt,
        question,
        discussionId,
      });
      realmInstance.write(() => {
        realmInstance.create('GPTResponses', {
          id: new Date().getTime(),
          discussionId: Number(discussionId),
          timestamp: new Date(),
          prompt: question,
          response: response.parsedDescription,
          responseType: 'gpt response',
          cleared: false,
          synced: false,
        });
      });
      responses.push(response.parsedDescription);
    }
    return responses;
  } catch (error) {
    console.error('Error dispersing question:', error);
    return undefined;
  }
}
export async function addOrUpdateGPTResponse(
  discussionId: string,
  response: string,
  responseType: string,
  cleared: boolean = false
): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  const realmInstance = realm;
  try {
    const id = new Date().getTime();
    realmInstance.write(() => {
      realmInstance.create('GPTResponses', {
        id,
        discussionId: Number(discussionId),
        response,
        responseType,
        timestamp: new Date(),
        cleared,
        synced: false,
      });
    });
    console.log('GPT Response saved.');
  } catch (error) {
    console.error('Error adding/updating GPT response:', error);
  }
}

export async function getGPTResponses(discussionId: string): Promise<any[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const responses = realm
      .objects<GPTResponse>('GPTResponses')
      .filtered('discussionId == $0', Number(discussionId));
    return Array.from(responses);
  } catch (error) {
    console.error('Error getting GPT responses:', error);
    return [];
  }
}

export async function getParsedGPTResponses(
  discussionId: string
): Promise<string[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const responses = realm
      .objects<GPTResponse>('GPTResponses')
      .filtered(
        'discussionId == $0 AND responseType == "parsed answer"',
        Number(discussionId)
      );
    return responses.map((doc) => doc.response);
  } catch (error) {
    console.error('Error getting parsed GPT responses:', error);
    return [];
  }
}

export async function getAIResponse(question: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`This is an AI-generated response to: "${question}"`);
    }, 2000);
  });
}

export async function syncToCloud(
  tableName: string,
  payload: any,
  method: 'POST' | 'PUT' | 'DELETE'
): Promise<void> {
  const isOnline = true;
  if (!isOnline) {
    console.log('Device is offline. Sync will be attempted later.');
    updateRealmSyncStatus(tableName, Number(payload.id), false);
    return;
  }
  const url = `${process.env.EXPO_PUBLIC_API_URL}${tableName.toLowerCase()}/`;
  try {
    const config = { headers: { 'Content-Type': 'application/json' } };
    let response;
    if (method === 'POST') {
      response = await axios.post(url, payload, config);
    } else if (method === 'PUT') {
      response = await axios.put(url, payload, config);
    } else if (method === 'DELETE') {
      response = await axios.delete(`${url}${payload.id}`, config);
    }
    console.log(`${tableName} synced successfully.`);
    updateRealmSyncStatus(tableName, Number(payload.id), true);
  } catch (error) {
    console.error(`Error syncing ${tableName} to cloud:`, error);
    updateRealmSyncStatus(tableName, Number(payload.id), false);
  }
}

const updateRealmSyncStatus = (
  tableName: string,
  id: number,
  synced: boolean
): void => {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const record = realm?.objectForPrimaryKey(tableName, id);
      if (record) {
        record.synced = synced;
        record.syncTimestamp = new Date();
      }
    });
  } catch (error) {
    console.error(`Error updating sync status for ${tableName}:`, error);
  }
};

export async function getNextActiveAlert(): Promise<any | null> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const alerts = realm
      .objects<Alert>('Alert')
      .filtered('isActive == true')
      .sorted('nextTrigger', true);
    return alerts.length > 0 ? alerts[0] : null;
  } catch (error) {
    console.error('Error fetching active alert:', error);
    return null;
  }
}

export async function addOrUpdateAlert(alertData: any): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const existingAlert = alertData._id
        ? realm?.objectForPrimaryKey<Alert>('Alert', alertData._id)
        : null;
      const alert = {
        id: alertData._id || new Date().getTime(),
        message: alertData.message,
        timestamp: new Date(),
        severity: alertData.severity,
        isActive: alertData.isActive !== undefined ? alertData.isActive : true,
        nextTrigger: alertData.nextTrigger
          ? new Date(alertData.nextTrigger)
          : new Date(),
        createdAt: new Date(),
        synced: false,
      };
      if (existingAlert) {
        Object.assign(existingAlert, alert);
      } else {
        realm?.create('Alert', alert);
      }
    });
    console.log(`Alert ${alertData._id ? 'updated' : 'added'} successfully.`);
  } catch (error) {
    console.error('Error adding/updating alert:', error);
  }
}

export async function deactivateAlertByKey(key: number): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const alert = realm?.objectForPrimaryKey<Alert>('Alert', key);
      if (alert) {
        alert.isActive = false;
        alert.synced = false;
        console.log(`Alert with key ${key} deactivated.`);
      }
    });
  } catch (error) {
    console.error(`Error deactivating alert with key ${key}:`, error);
  }
}

export async function getURLofGPT(
  gpt_name: string
): Promise<{ url: string; apiKey: string } | null> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const specialty = realm
      .objects<GPTSpecialty>('GPTSpecialties')
      .filtered('name == $0', gpt_name)[0];
    return specialty ? { url: specialty.url, apiKey: specialty.apiKey } : null;
  } catch (error) {
    console.error('Error fetching GPT specialty:', error);
    return null;
  }
}

export async function expandFromAbbreviation(
  discussion: string
): Promise<string> {
  const abbreviationMap = new Map<string, string>([
    ['1', 'i urinated'],
    ['11', 'i had a high volume of urination'],
    ['2', 'i had a regular size poop'],
    ['22', 'i had a large poop'],
  ]);
  const expandedForm = abbreviationMap.get(discussion);
  return expandedForm || discussion;
}

export async function restoreLostData(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
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
  try {
    const realmInstance = realm;
    realmInstance?.write(() => {
      for (const entry of lostData) {
        const id = Number(entry.id);
        const existing = realmInstance?.objectForPrimaryKey<ActivityLog>(
          'ActivityLog',
          id
        );
        if (!existing) {
          const ts =
            entry.timestamp !== undefined
              ? new Date(entry.timestamp)
              : new Date();
          realmInstance?.create('ActivityLog', {
            id,
            discussionId: id,
            description: entry.description,
            category: 'uncategorized',
            timestamp: ts,
            cleared: false,
            synced: false,
          });
        }
      }
    });
    console.log('Data restoration completed!');
  } catch (error) {
    console.error('Error restoring lost data:', error);
    throw error;
  }
}

export async function getRules(): Promise<Rule[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const realmInstance = realm;
    const rules =
      realmInstance?.objects<Rule>('Rule').map((rule) => ({
        pattern: rule.pattern,
        isRegex: rule.isRegex,
        category: rule.category,
        priority: rule.priority,
      })) ?? [];
    return rules.sort(
      (a, b) => (a.isRegex ? -1 : 1) || a.priority - b.priority
    );
  } catch (error) {
    console.error('Error fetching rules:', error);
    throw error;
  }
}

export async function updateGPTSpecialties(gptSpecialty: {
  id?: number;
  name: string;
  url: string;
  apiKey: string;
}): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const url = `${process.env.EXPO_PUBLIC_API_URL}gpt-specialties/`;
    const method = gptSpecialty.id ? 'PUT' : 'POST';
    const response = await axios({
      method,
      url,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(gptSpecialty),
    });
    realm.write(() => {
      const existing = gptSpecialty.id
        ? realm?.objectForPrimaryKey<GPTSpecialty>(
            'GPTSpecialties',
            gptSpecialty.id
          )
        : null;
      if (existing) {
        existing.name = gptSpecialty.name;
        existing.url = gptSpecialty.url;
        existing.apiKey = gptSpecialty.apiKey;
        existing.synced = false;
      } else {
        const realmInstance = realm;
        realmInstance?.create('GPTSpecialties', {
          id: new Date().getTime(),
          name: gptSpecialty.name,
          url: gptSpecialty.url,
          apiKey: gptSpecialty.apiKey,
          synced: false,
        });
      }
    });
    console.log('GPT Specialty updated:', response.data);
  } catch (error) {
    console.error('Error updating GPT specialty:', error);
    throw error;
  }
}
export class DatabaseService {
  async parseAndSaveInstructions(jsonData: any): Promise<void> {
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      const instructions = jsonData.instructions;
      const realmInstance = realm;
      realmInstance?.write(() => {
        for (const instruction of instructions) {
          const discussion = realmInstance
            ?.objects<Discussion>('Discussion')
            .filtered('id == $0', Number(instruction.id))[0];
          if (discussion) {
            const timestamp = new Date(discussion.timestamp);
            const existingLog = realmInstance
              ?.objects<ActivityLog>('ActivityLog')
              .filtered('discussionId == $0', discussion.id)[0];
            const logData = {
              id: existingLog ? existingLog.id : new Date().getTime(),
              discussionId: discussion.id,
              category: instruction.category,
              description: instruction.description,
              timestamp,
              cleared: false,
              synced: false,
            };
            if (existingLog) {
              Object.assign(existingLog, logData);
              console.log(`Updated ActivityLog ${logData.id}`);
            } else {
              realmInstance?.create('ActivityLog', logData);
              console.log(`Added ActivityLog ${logData.id}`);
            }
          } else {
            console.log(`Discussion with ID ${instruction.id} not found`);
          }
        }
      });
      console.log('Instructions parsed and saved successfully');
    } catch (error) {
      console.error('Error parsing and saving instructions:', error);
    }
  }

  async getDiscussionById(id: string): Promise<Discussion | null> {
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      const realmInstance = realm;
      const discussion = realmInstance?.objectForPrimaryKey<Discussion>(
        'Discussion',
        Number(id)
      );
      return discussion || null;
    } catch (error) {
      console.error('Error getting discussion by ID:', error);
      return null;
    }
  }

  async getExistingLog(timestamp: Date): Promise<ActivityLog | null> {
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      const log = realm
        .objects<ActivityLog>('ActivityLog')
        .filtered('timestamp == $0', timestamp)[0];
      return log || null;
    } catch (error) {
      console.error('Error getting existing log:', error);
      return null;
    }
  }

  async getActivityLogByTimestamp(
    timestamp: Date
  ): Promise<ActivityLog | null> {
    return this.getExistingLog(timestamp);
  }

  async updateActivityLog(log: ActivityLog): Promise<void> {
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      const realmInstance = realm;
      realmInstance?.write(() => {
        const existingLog = realmInstance?.objectForPrimaryKey<ActivityLog>(
          'ActivityLog',
          log.id
        );
        if (existingLog) {
          existingLog.category = log.category;
          existingLog.description = log.description;
          existingLog.timestamp = log.timestamp;
          existingLog.cleared = log.cleared;
          existingLog.responseType = log.responseType;
          existingLog.synced = false;
          console.log(`Updated ActivityLog ${log.id}`);
        }
      });
    } catch (error) {
      console.error('Error updating ActivityLog:', error);
    }
  }

  async addActivityLog(log: ActivityLog): Promise<void> {
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      const realmInstance = realm;
      realmInstance?.write(() => {
        realmInstance?.create('ActivityLog', {
          id: log.id,
          discussionId: log.discussionId,
          category: log.category,
          description: log.description,
          timestamp: log.timestamp,
          cleared: log.cleared,
          responseType: log.responseType,
          synced: false,
        });
        console.log(`Added ActivityLog ${log.id}`);
      });
    } catch (error) {
      console.error('Error adding ActivityLog:', error);
    }
  }

  // Local implementation for creating an ActivityLog with auto-generated id
  async createActivityLog(
    activityLog: Omit<ActivityLog, 'id'>
  ): Promise<string> {
    if (!realm) throw new Error('Realm not initialized');
    let createdId = '';
    realm.write(() => {
      const created = realm?.create('ActivityLog', {
        ...activityLog,
        id: new Date().getTime(),
      });
      if (created) {
        createdId = String(created.id);
      }
    });
    return createdId;
  }
}
// --- STUBS FOR DB SERVICES ---
export async function getActivityLogs() {
  return [];
}
export async function getParameters() {
  return [];
}
export async function getDescriptionsWithTimestamps(categories: string[]) {
  return '[]';
}
export async function deleteActivityLog(activityLogId: string) {
  return;
}
export async function createActivityLog(activityLog: any) {
  return '';
}
export async function updateActivityLogCategory(
  activityLogId: string,
  category: string
) {
  return;
}
export async function createRuleCandidate(data: {
  discussionId: string;
  category: string;
  description: string;
  uid: string;
}) {
  return;
}
/**
 * Retrieves ChangeLog entries from the local Realm database, optionally filtered by criteria.
 * @param filter - Optional filter object to query ChangeLog entries.
 * @param filter.synced - Filter by sync status (true/false).
 * @param filter.tableName - Filter by table name (e.g., 'ActivityLog').
 * @param filter.operation - Filter by operation type ('create', 'update', 'delete').
 * @param sortBy - Optional field to sort by (default: 'timestamp').
 * @param sortAscending - Sort direction (default: false for descending).
 * @returns An array of ChangeLog entries matching the criteria.
 * @throws Error if Realm is not initialized.
 */
/**
 * Updates a ChangeLog entry in the local Realm database.
 * @param id - The ID of the ChangeLog entry to update.
 * @param updates - Partial ChangeLog data to apply (e.g., { synced: true }).
 * @throws Error if Realm is not initialized or if the entry is not found.
 */
export const logChange = (
  tableName: string,
  rowId: string,
  operation: 'create' | 'update' | 'delete'
): void => {
  // Existing logChange function
};

/**
 * Retrieves ChangeLog entries from the local Realm database, optionally filtered by criteria.
 * @param filter - Optional filter object to query ChangeLog entries.
 * @param filter.synced - Filter by sync status (true/false).
 * @param filter.tableName - Filter by table name (e.g., 'ActivityLog').
 * @param filter.operation - Filter by operation type ('create', 'update', 'delete').
 * @param sortBy - Optional field to sort by (default: 'timestamp').
 * @param sortAscending - Sort direction (default: false for descending).
 * @returns An array of ChangeLog entries matching the criteria.
 * @throws Error if Realm is not initialized.
 */
export const readChangeLog = (
  filter: {
    synced?: boolean;
    tableName?: string;
    operation?: 'create' | 'update' | 'delete';
  } = {},
  sortBy: string = 'timestamp',
  sortAscending: boolean = false
): ChangeLog[] => {
  const realmInstance = realm;
  if (!realmInstance) {
    console.error('[CHANGELOG] Realm not initialized in readChangeLog');
    throw new Error('Realm not initialized');
  }
  console.log('[CHANGELOG] Reading ChangeLog entries with filter:', filter);
  console.log(`[CHANGELOG] Sorting by ${sortBy}, ascending: ${sortAscending}`);

  try {
    let query = '';
    const queryParams: any[] = [];
    if (filter.synced !== undefined) {
      query += query ? ' AND ' : '';
      query += 'synced == $' + queryParams.length;
      queryParams.push(filter.synced);
    }
    if (filter.tableName) {
      query += query ? ' AND ' : '';
      query += 'tableName == $' + queryParams.length;
      queryParams.push(filter.tableName);
    }
    if (filter.operation) {
      query += query ? ' AND ' : '';
      query += 'operation == $' + queryParams.length;
      queryParams.push(filter.operation);
    }

    console.log(
      `[CHANGELOG] Querying ChangeLog with filter: ${query || 'none'}`
    );
    let results = realmInstance.objects<ChangeLog>('ChangeLog');
    if (query) {
      results = results.filtered(query, ...queryParams);
    }
    results = results.sorted(sortBy, !sortAscending);

    const changeLogs = results.map((change) => ({
      id: change.id,
      tableName: change.tableName,
      rowId: change.rowId,
      operation: change.operation,
      timestamp: change.timestamp,
      synced: change.synced,
    }));
    console.log(`[CHANGELOG] Retrieved ${changeLogs.length} ChangeLog entries`);
    return changeLogs;
  } catch (error) {
    console.error('[CHANGELOG] Error reading ChangeLog entries:', error);
    console.error(`[CHANGELOG] Error details:`, (error as any).message);
    throw error;
  }
};

/**
 * Updates a ChangeLog entry in the local Realm database.
 * @param id - The ID of the ChangeLog entry to update.
 * @param updates - Partial ChangeLog data to apply (e.g., { synced: true }).
 * @throws Error if Realm is not initialized or if the entry is not found.
 */
export const updateChangeLog = (
  id: string,
  updates: Partial<ChangeLog>
): void => {
  const realmInstance = realm;
  if (!realmInstance) {
    console.error('[CHANGELOG] Realm not initialized in updateChangeLog');
    throw new Error('Realm not initialized');
  }
  console.log(`[CHANGELOG] Updating ChangeLog entry with ID: ${id}`);
  console.log(`[CHANGELOG] Applying updates:`, updates);

  try {
    const realmInstance = realm;
    realmInstance?.write(() => {
      const change = realmInstance?.objectForPrimaryKey<ChangeLog>(
        'ChangeLog',
        id
      );
      if (!change) {
        console.error(`[CHANGELOG] ChangeLog entry not found with ID: ${id}`);
        throw new Error(`ChangeLog entry not found: ${id}`);
      }
      console.log(`[CHANGELOG] Found ChangeLog entry, applying updates`);
      Object.assign(change, updates);
      logChange('ChangeLog', id, 'update');
      console.log(`[CHANGELOG] ChangeLog entry updated successfully: ${id}`);
    });
  } catch (error) {
    console.error(
      `[CHANGELOG] Error updating ChangeLog entry with ID ${id}:`,
      error
    );
    console.error(`[CHANGELOG] Error details:`, (error as any).message);
    throw error;
  }
};

/**
 * Deletes a ChangeLog entry from the local Realm database.
 * @param id - The ID of the ChangeLog entry to delete.
 * @throws Error if Realm is not initialized or if the entry is not found.
 */
export const deleteChangeLog = (id: string): void => {
  const realmInstance = realm;
  if (!realmInstance) {
    console.error('[CHANGELOG] Realm not initialized in deleteChangeLog');
    throw new Error('Realm not initialized');
  }
  console.log(`[CHANGELOG] Deleting ChangeLog entry with ID: ${id}`);
  try {
    const realmInstance = realm;
    realmInstance?.write(() => {
      const change = realmInstance.objectForPrimaryKey<ChangeLog>(
        'ChangeLog',
        id
      );
      if (!change) {
        console.error(`[CHANGELOG] ChangeLog entry not found with ID: ${id}`);
        throw new Error(`ChangeLog entry not found: ${id}`);
      }
      console.log(`[CHANGELOG] Deleting ChangeLog entry`);
      realmInstance.delete(change);
      logChange('ChangeLog', id, 'delete');
      console.log(`[CHANGELOG] ChangeLog entry deleted successfully: ${id}`);
    });
  } catch (error) {
    console.error(
      `[CHANGELOG] Error deleting ChangeLog entry with ID ${id}:`,
      error
    );
    console.error(`[CHANGELOG] Error details:`, (error as any).message);
    throw error;
  }
};

// Export ChangeLog interface for use throughout the file
export interface ChangeLog {
  id: string;
  tableName: string;
  rowId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: Date;
  synced: boolean;
}
