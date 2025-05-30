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
import { getUID } from '../utils/uidManager';
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
  uid: string;
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
  uid: string;
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
  uid: string;
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
  uid: string;
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
  uid: string;
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
  uid: string;
}

export const findDuplicateActivityLog = (
  discussionId: string,
  category: string,
  description: string,
  uid: string
): IActivityLog | null => {
  if (!realm) throw new Error('Realm not initialized');
  console.log(
    `Checking for duplicate ActivityLog: ${discussionId}, ${category}`
  );

  try {
    const logs = realm
      .objects<IActivityLog>('ActivityLog')
      .filtered(
        'discussionId == $0 AND category == $1 AND description == $2 AND uid == $3',
        discussionId,
        category,
        description,
        uid
      );

    if (logs.length === 0) {
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
      uid: log.uid,
      synced: log.synced,
      syncTimestamp: log.syncTimestamp,
    };
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
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      realm.create('SyncEntry', {
        id: entry.id,
        tableName: entry.tableName,
        operation: entry.operation,
        timestamp: entry.timestamp,
        uid: entry.uid,
      });
    });
    console.log('Logged SyncEntry to Realm:', entry);
  } catch (error) {
    console.error('Error logging SyncEntry to Realm:', error);
    throw error;
  }
}

// ... rest of dbServicesLocal.ts (unchanged, including restoreLostData) ...

export async function initializeUser(): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No user signed in');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    console.log(`Initializing user for UID: ${uid}`);
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const existingUser = realm
        .objects<User>('User')
        .filtered('uid == $0', uid)[0];
      const userData = {
        id: uid,
        appVersion: APP_VERSION,
        appId: APP_ID,
        timestamp: new Date(),
        uid,
        isPaid: false, // Update based on subscription check
      };
      if (existingUser) {
        Object.assign(existingUser, userData);
      } else {
        realm.create('User', userData);
      }
    });
    console.log('User initialized successfully');
  } catch (error) {
    console.error('Error initializing user:', error);
    throw error;
  }
}

export async function createDocument(data: any): Promise<string> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for create operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const id = new Date().getTime();
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      realm.create('Document', {
        id,
        ...data,
        uid,
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for read operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const documents = realm
      .objects('Document')
      .filtered('uid == $0', uid)
      .map((doc) => ({ id: doc.id, ...doc }));
    console.log('Documents retrieved:', documents);
    return documents;
  } catch (error) {
    console.error('Error reading documents:', error);
    throw error;
  }
}

export async function updateDocument(docId: string, data: any): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for update operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const doc = realm.objectForPrimaryKey('Document', Number(docId));
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for delete operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const doc = realm.objectForPrimaryKey('Document', Number(docId));
      if (doc) {
        realm.delete(doc);
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
        realm.objects<ActivityLog>('ActivityLog').map((item) => item.category)
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for insert operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      jsonData.forEach((item: any) => {
        const id = new Date().getTime();
        const entry = {
          id,
          discussionId: id,
          category: item.category,
          description: item.value,
          timestamp: new Date(),
          cleared: false,
          uid,
          synced: false,
        };
        realm!.create('ActivityLog', entry);
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

export async function synchronizeActivityLog(
  appVersion: string
): Promise<void> {
  if (!ENABLE_ACTIVITYLOG_SYNC) {
    console.log('ActivityLog synchronization disabled.');
    return;
  }
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for ActivityLog synchronization');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    console.log(`Synchronizing ActivityLog for UID: ${uid}`);
    const globalLogs = realm
      .objects<ActivityLog>('ActivityLog')
      .filtered('uid == $0', uid);
    const userLogs = realm
      .objects<ActivityLog>('ActivityLog')
      .filtered('uid == $0', uid);
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      globalLogs.forEach((log) => {
        const exists = userLogs.some((userLog) => userLog.id === log.id);
        if (!exists) {
          realm!.create('ActivityLog', { ...log, uid, synced: false });
        }
      });
      userLogs.forEach((log) => {
        const exists = globalLogs.some((globalLog) => globalLog.id === log.id);
        if (!exists) {
          realm!.create('ActivityLog', { ...log, uid, synced: false });
        }
      });
    });
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for Discussion synchronization');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    console.log(`Synchronizing Discussions for UID: ${uid}`);
    const globalDiscussions = realm
      .objects<Discussion>('Discussion')
      .filtered('uid == $0', uid);
    const userDiscussions = realm
      .objects<Discussion>('Discussion')
      .filtered('uid == $0', uid);
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      globalDiscussions.forEach((discussion) => {
        const exists = userDiscussions.some(
          (userDiscussion) => userDiscussion.id === discussion.id
        );
        if (!exists) {
          realm!.create('Discussion', { ...discussion, uid, synced: false });
        }
      });
      userDiscussions.forEach((discussion) => {
        const exists = globalDiscussions.some(
          (globalDiscussion) => globalDiscussion.id === discussion.id
        );
        if (!exists) {
          realm!.create('Discussion', { ...discussion, uid, synced: false });
        }
      });
    });
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for discussion operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const currentTime = new Date();
    const discussionId = id || currentTime.getTime();
    const payload: DiscussionCloudPayload = {
      DiscussionId: discussionId.toString(),
      UserId: uid,
      description,
      Operation: id ? 'update' : 'add',
      typeSay,
    };
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const discussion = realm.objectForPrimaryKey<Discussion>(
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
        uid,
        synced: false,
        syncTimestamp: currentTime,
      };
      if (discussion) {
        if (!description) {
          realm.delete(discussion);
          payload.Operation = 'delete';
        } else {
          Object.assign(discussion, discussionData);
        }
      } else {
        realm.create('Discussion', discussionData);
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for add discussion operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const discussions = realm
        .objects<Discussion>('Discussion')
        .filtered(
          'description == null OR description == "" AND uid == $0',
          uid
        );
      realm.delete(discussions);
    });
    const currentTime = new Date();
    const id = currentTime.getTime();
    const payload: DiscussionCloudPayload = {
      DiscussionId: id.toString(),
      UserId: uid,
      description,
      Operation: 'add',
      typeSay,
    };
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      realm.create('Discussion', {
        id,
        discussionId: id,
        timestamp: currentTime,
        description,
        cleared: false,
        typeSay,
        uid,
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
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const discussion = realm.objectForPrimaryKey<Discussion>(
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get discussions operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    let discussions = realm
      .objects<Discussion>('Discussion')
      .filtered('uid == $0', uid)
      .sorted('timestamp', true);
    if (discussionId) {
      const discussion = realm.objectForPrimaryKey<Discussion>(
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
            .join(',')}} AND uid == $0`,
          uid
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
      uid: doc.uid,
    }));
  } catch (error) {
    console.error('Error getting Discussions:', error);
    return [];
  }
}

export async function deleteDiscussion(id: number): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for delete discussion operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const discussion = realm.objectForPrimaryKey<Discussion>(
        'Discussion',
        id
      );
      if (discussion && discussion.uid === uid) {
        realm.delete(discussion);
        console.log(`Discussion with ID ${id} deleted.`);
      }
    });
  } catch (error) {
    console.error(`Error deleting discussion with ID ${id}:`, error);
  }
}

export async function fetchInitialDiscussion(): Promise<any | null> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for fetch initial discussion operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const discussions = realm
      .objects<Discussion>('Discussion')
      .filtered('uid == $0', uid)
      .sorted('timestamp', true);
    if (discussions.length > 0) {
      const doc = discussions[0];
      return {
        id: doc.id,
        discussionId: doc.discussionId || doc.id,
        description: doc.description,
        timestamp: new Date(doc.timestamp),
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get next open discussion operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    let discussions = realm
      .objects<Discussion>('Discussion')
      .filtered('cleared == false AND typeSay == "ask" AND uid == $0', uid);
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for processing pending tells');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const discussions = realm
      .objects<Discussion>('Discussion')
      .filtered('typeSay == "tell" AND cleared == false AND uid == $0', uid);
    if (discussions.length === 0) {
      console.log('No pending tell statements to process.');
      return;
    }
    const rules = await getRules();
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
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
        realm!.create('ActivityLog', {
          id: new Date().getTime(),
          discussionId: doc.id,
          description: doc.description,
          category,
          timestamp: doc.timestamp,
          cleared: false,
          uid,
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for add question discussion operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
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
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      realm.create('GPTResponses', {
        id,
        discussionId: Number(discussionId),
        timestamp: new Date(),
        prompt: question,
        response: JSON.stringify(response),
        responseType: 'parsed question',
        cleared: false,
        uid,
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
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for process uncleared GPT responses operation'
    );
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    let hasMore = true;
    while (hasMore) {
      const responses = realm
        .objects<GPTResponse>('GPTResponses')
        .filtered(
          'cleared == false AND responseType == "updateDB" AND uid == $0',
          uid
        )
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
        .objects<ActivityLog>('ActivityLog')
        .filtered('discussionId == $0 AND uid == $1', discussionId, uid)[0];
      realm.write(() => {
        if (!realm) {
          console.error('Failed to open Realm instance');
          throw new Error('Failed to open Realm instance');
        }
        if (activityLog) {
          activityLog.category = responseJson.category;
          activityLog.description = responseJson.parsedDescription;
          activityLog.responseType = 'tell';
          activityLog.cleared = true;
          activityLog.synced = false;
        } else {
          realm.create('ActivityLog', {
            id: new Date().getTime(),
            discussionId,
            category: responseJson.category,
            description: responseJson.parsedDescription,
            timestamp,
            cleared: true,
            uid,
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
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for mark discussion as cleared operation'
    );
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const discussion = realm.objectForPrimaryKey<Discussion>(
        'Discussion',
        Number(discussionId)
      );
      if (discussion && discussion.uid === uid) {
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for clear discussion operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const discussion = realm.objectForPrimaryKey<Discussion>(
        'Discussion',
        Number(discussionId)
      );
      if (discussion && discussion.uid === uid) {
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
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for add or update activity log operation'
    );
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const responses = realm
      .objects<GPTResponse>('GPTResponses')
      .filtered(
        'cleared == false AND responseType == "updateDB" AND uid == $0',
        uid
      );
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
      const activityLog = realm
        .objects<ActivityLog>('ActivityLog')
        .filtered('discussionId == $0 AND uid == $1', discussionId, uid)[0];
      realm.write(() => {
        if (!realm) {
          console.error('Failed to open Realm instance');
          throw new Error('Failed to open Realm instance');
        }
        if (activityLog) {
          activityLog.category = category;
          activityLog.description = parsedDescription;
          activityLog.responseType = 'tell';
          activityLog.cleared = true;
          activityLog.synced = false;
        } else {
          realm.create('ActivityLog', {
            id: new Date().getTime(),
            discussionId,
            category,
            description: parsedDescription,
            timestamp,
            cleared: true,
            uid,
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for rename field to cleared operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const discussions = realm
        .objects<Discussion>('Discussion')
        .filtered('uid == $0', uid);
      discussions.forEach((doc) => {
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get last open discussion operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const discussions = realm
      .objects<Discussion>('Discussion')
      .filtered(
        'cleared == false AND description != null AND description != "" AND uid == $0',
        uid
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for disperse question operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const discussion = realm.objectForPrimaryKey<Discussion>(
      'Discussion',
      Number(discussionId)
    );
    if (!discussion) {
      console.log(`No discussion found with ID: ${discussionId}`);
      return undefined;
    }
    const gptResponse = realm.objectForPrimaryKey<GPTResponse>(
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
      realm.write(() => {
        if (!realm) {
          console.error('Failed to open Realm instance');
          throw new Error('Failed to open Realm instance');
        }
        realm.create('GPTResponses', {
          id: new Date().getTime(),
          discussionId: Number(discussionId),
          timestamp: new Date(),
          prompt: question,
          response: response.parsedDescription,
          responseType: 'gpt response',
          cleared: false,
          uid,
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
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for add or update GPT response operation'
    );
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const id = new Date().getTime();
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      realm.create('GPTResponses', {
        id,
        discussionId: Number(discussionId),
        response,
        responseType,
        timestamp: new Date(),
        cleared,
        uid,
        synced: false,
      });
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
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const responses = realm
      .objects<GPTResponse>('GPTResponses')
      .filtered('discussionId == $0 AND uid == $1', Number(discussionId), uid);
    return Array.from(responses);
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
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const responses = realm
      .objects<GPTResponse>('GPTResponses')
      .filtered(
        'discussionId == $0 AND responseType == "parsed answer" AND uid == $1',
        Number(discussionId),
        uid
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for sync to cloud operation');
  }
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
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const record = realm.objectForPrimaryKey(tableName, id);
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get next active alert operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const alerts = realm
      .objects<Alert>('Alert')
      .filtered('isActive == true AND uid == $0', uid)
      .sorted('nextTrigger', true);
    return alerts.length > 0 ? alerts[0] : null;
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
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const existingAlert = alertData._id
        ? realm.objectForPrimaryKey<Alert>('Alert', alertData._id)
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
        uid,
        synced: false,
      };
      if (existingAlert) {
        Object.assign(existingAlert, alert);
      } else {
        realm.create('Alert', alert);
      }
    });
    console.log(`Alert ${alertData._id ? 'updated' : 'added'} successfully.`);
  } catch (error) {
    console.error('Error adding/updating alert:', error);
  }
}

export async function deactivateAlertByKey(key: number): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for deactivate alert operation');
  }
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const alert = realm.objectForPrimaryKey<Alert>('Alert', key);
      if (alert && alert.uid === uid) {
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
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for restore lost data operation');
  }
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
    realm.write(() => {
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      for (const entry of lostData) {
        const id = Number(entry.id);
        const existing = realm.objectForPrimaryKey<ActivityLog>(
          'ActivityLog',
          id
        );
        if (!existing) {
          realm.create('ActivityLog', {
            id,
            discussionId: id,
            description: entry.description,
            category: 'uncategorized',
            timestamp: new Date(entry.timestamp),
            cleared: false,
            uid,
            synced: false,
          });
          console.log(`Restored document: ${entry.id}`);
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
    const rules = realm.objects<Rule>('Rule').map((rule) => ({
      pattern: rule.pattern,
      isRegex: rule.isRegex,
      category: rule.category,
      priority: rule.priority,
    }));
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
      if (!realm) {
        console.error('Failed to open Realm instance');
        throw new Error('Failed to open Realm instance');
      }
      const existing = gptSpecialty.id
        ? realm.objectForPrimaryKey<GPTSpecialty>(
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
        realm.create('GPTSpecialties', {
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
    const uid = await getUID();
    if (!uid) {
      throw new Error(
        'No UID available for parse and save instructions operation'
      );
    }
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      const instructions = jsonData.instructions;
      realm.write(() => {
        if (!realm) {
          console.error('Failed to open Realm instance');
          throw new Error('Failed to open Realm instance');
        }
        for (const instruction of instructions) {
          const discussion = realm
            .objects<Discussion>('Discussion')
            .filtered('id == $0 AND uid == $1', Number(instruction.id), uid)[0];
          if (discussion) {
            const timestamp = new Date(discussion.timestamp);
            const existingLog = realm
              .objects<ActivityLog>('ActivityLog')
              .filtered(
                'discussionId == $0 AND uid == $1',
                discussion.id,
                uid
              )[0];
            const logData = {
              id: existingLog ? existingLog.id : new Date().getTime(),
              discussionId: discussion.id,
              category: instruction.category,
              description: instruction.description,
              timestamp,
              cleared: false,
              uid,
              synced: false,
            };
            if (existingLog) {
              Object.assign(existingLog, logData);
              console.log(`Updated ActivityLog ${logData.id}`);
            } else {
              realm.create('ActivityLog', logData);
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
    const uid = await getUID();
    if (!uid) {
      throw new Error('No UID available for get discussion by ID operation');
    }
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      const discussion = realm.objectForPrimaryKey<Discussion>(
        'Discussion',
        Number(id)
      );
      return discussion && discussion.uid === uid ? discussion : null;
    } catch (error) {
      console.error('Error getting discussion by ID:', error);
      return null;
    }
  }

  async getExistingLog(timestamp: Date): Promise<ActivityLog | null> {
    const uid = await getUID();
    if (!uid) {
      throw new Error('No UID available for get existing log operation');
    }
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      const log = realm
        .objects<ActivityLog>('ActivityLog')
        .filtered('timestamp == $0 AND uid == $1', timestamp, uid)[0];
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
    const uid = await getUID();
    if (!uid) {
      throw new Error('No UID available for update activity log operation');
    }
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      realm.write(() => {
        if (!realm) {
          console.error('Failed to open Realm instance');
          throw new Error('Failed to open Realm instance');
        }
        const existingLog = realm.objectForPrimaryKey<ActivityLog>(
          'ActivityLog',
          log.id
        );
        if (existingLog && existingLog.uid === uid) {
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
    const uid = await getUID();
    if (!uid) {
      throw new Error('No UID available for add activity log operation');
    }
    if (!realm) {
      console.error('Failed to open Realm instance');
      throw new Error('Failed to open Realm instance');
    }
    try {
      realm.write(() => {
        if (!realm) {
          console.error('Failed to open Realm instance');
          throw new Error('Failed to open Realm instance');
        }
        realm.create('ActivityLog', {
          id: log.id,
          discussionId: log.discussionId,
          category: log.category,
          description: log.description,
          timestamp: log.timestamp,
          cleared: log.cleared,
          responseType: log.responseType,
          uid,
          synced: false,
        });
        console.log(`Added ActivityLog ${log.id}`);
      });
    } catch (error) {
      console.error('Error adding ActivityLog:', error);
    }
  }

  async createActivityLog(
    activityLog: Omit<ActivityLog, 'id'>
  ): Promise<string> {
    // Realm: create and return the new object's id as a string
    const realm = await Realm.open({
      schema: [
        /* your schemas here */
      ],
    });
    let createdId = '';
    realm.write(() => {
      const created = realm.create('ActivityLog', {
        ...activityLog,
        id: new Realm.BSON.ObjectId().toHexString(),
      });
      createdId = created.id;
    });
    realm.close();
    return createdId;
  }
}

export async function getParameters(): Promise<Parameters[]> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available');
  try {
    if (!realm) {
      console.warn('Realm not initialized, returning empty parameters');
      return [];
    }
    const snapshot = realm.objects('Parameters').filtered('uid == $0', uid);
    return snapshot.map((doc: any) => ({
      parameterName: doc.parameterName,
      parameterValue: doc.parameterValue,
    }));
  } catch (error) {
    console.error('Error in getParameters:', error);
    return [];
  }
}

export async function addDiscussionCount(
  uid: string,
  count: DiscussionCount & { description: string }
): Promise<void> {
  if (!realm) throw new Error('Realm not initialized');
  realm.write(() => {
    realm!.create(
      'DiscussionCount',
      {
        ...count,
        uid,
        timestamp: count.timestamp || new Date(),
      },
      Realm.UpdateMode.Modified
    );
  });
}

export const databaseService = new DatabaseService();

export { type Discussion, type GPTSpecialty, type GPTResponse, type Alert };
export async function updateActivityLogCategory(
  activityLogId: string,
  category: string
): Promise<void> {
  if (!realm) throw new Error('Realm not initialized');
  const uid = await getUID();
  realm!.write(() => {
    const log = realm!.objectForPrimaryKey(
      'ActivityLog',
      Number(activityLogId)
    );
    if (log && log.uid === uid) {
      log.category = category;
      log.lockedCategory = true;
      log.synced = false;
    }
  });
}

export async function createRuleCandidate(data: {
  discussionId: string;
  category: string;
  description: string;
  uid: string;
}): Promise<void> {
  if (!realm) throw new Error('Realm not initialized');
  try {
    realm!.write(() => {
      if (realm!.schema.find((s) => s.name === 'RuleCandidate')) {
        realm!.create('RuleCandidate', {
          id: new Date().getTime(),
          discussionId: data.discussionId,
          category: data.category,
          description: data.description,
          uid: data.uid,
          timestamp: new Date(),
        });
      } else {
        console.log('RuleCandidate schema not found, skipping local create.');
      }
    });
  } catch (e) {
    console.error('Error creating RuleCandidate locally:', e);
  }
}

// Add a local implementation for deleting an ActivityLog by id
export async function deleteActivityLog(activityLogId: string): Promise<void> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for delete operation');
  if (!realm) throw new Error('Realm not initialized');
  realm.write(() => {
    const log = realm!.objectForPrimaryKey(
      'ActivityLog',
      Number(activityLogId)
    );
    if (log && log.uid === uid) {
      realm!.delete(log);
      console.log(`ActivityLog with ID ${activityLogId} deleted.`);
    }
  });
}

// Add a local implementation for creating an ActivityLog
export async function createActivityLog(
  activityLog: Omit<ActivityLog, 'id'>
): Promise<string> {
  if (!realm) throw new Error('Realm not initialized');
  let createdId = '';
  realm.write(() => {
    const created = realm!.create('ActivityLog', {
      ...activityLog,
      id: new Date().getTime(),
    });
    createdId = String(created.id);
  });
  return createdId;
}

// Return all ActivityLogs for the current user
export async function getActivityLogs(): Promise<ActivityLog[]> {
  const uid = await getUID();
  if (!uid) throw new Error('No UID available for getActivityLogs');
  if (!realm) throw new Error('Realm not initialized');
  return realm
    .objects<ActivityLog>('ActivityLog')
    .filtered('uid == $0', uid)
    .map((log) => ({ ...log }));
}

// Return descriptions with timestamps for given categories
export async function getDescriptionsWithTimestamps(
  categories: string[]
): Promise<string> {
  const uid = await getUID();
  if (!uid)
    throw new Error('No UID available for getDescriptionsWithTimestamps');
  if (!realm) throw new Error('Realm not initialized');
  const logs = realm
    .objects<ActivityLog>('ActivityLog')
    .filtered('category IN $0 AND uid == $1', categories, uid);
  const descriptionsWithTimestamps = logs.map((log: any) => ({
    description: log.description,
    timestamp:
      log.timestamp instanceof Date
        ? log.timestamp.toISOString()
        : String(log.timestamp),
  }));
  return JSON.stringify(descriptionsWithTimestamps);
}

// Return true for isPaidUser (local fallback)
export async function isPaidUser(): Promise<boolean> {
  return true;
}

// Add the missing DiscussionCount interface for type safety
export interface DiscussionCount {
  id: number;
  discussionId: number;
  count: number;
  description: string;
  uid: string;
  timestamp: Date;
}
