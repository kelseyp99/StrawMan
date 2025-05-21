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

const APP_VERSION = '1.1.0';
const APP_ID = 'com.anonymous.lifelog';

// Toggle for synchronization
const ENABLE_DISCUSSION_SYNC = false;
const ENABLE_ACTIVITYLOG_SYNC = false;

declare var confirm: (message: string) => boolean;

interface ActivityLog {
  id: number;
  discussionId: number;
  category: string;
  description: string;
  timestamp: Date;
  cleared: boolean;
  responseType?: string;
  uid?: string;
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

interface Parameters {
  parameterName: string;
  parameterValue: string;
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
}

interface GPTResponse {
  id: number;
  discussionId: number;
  timestamp: Date;
  prompt: string;
  response: string;
  responseType: string;
  cleared: boolean;
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

export async function initializeUser(): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No user signed in');
  }
  try {
    console.log(`Initializing user for UID: ${uid}`);
    realm.write(() => {
      const existingUser = realm.objects('User').filtered('uid == $0', uid)[0];
      const userData = {
        id: uid,
        appVersion: APP_VERSION,
        appId: APP_ID,
        timestamp: new Date(),
        uid,
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
  try {
    const id = new Date().getTime();
    realm.write(() => {
      realm.create('Document', {
        id,
        ...data,
        uid,
        timestamp: new Date(),
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
  try {
    const documents = realm
      .objects('Document')
      .filtered('uid == $0')
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
  try {
    realm.write(() => {
      const doc = realm.objectForPrimaryKey('Document', Number(docId));
      if (doc) {
        Object.assign(doc, data);
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
  try {
    realm.write(() => {
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
  try {
    const categories = Array.from(
      new Set(
        realm.objects('ActivityLog').map((item: any) => item.category as string)
      )
    ).filter((cat) => cat !== 'Uncategorized');
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
  try {
    realm.write(() => {
      jsonData.forEach((item: any) => {
        const id = new Date().getTime();
        const entry = {
          id,
          category: item.category,
          description: item.value,
          timestamp: new Date(),
          cleared: false,
          uid,
        };
        realm.create('ActivityLog', entry);
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
  try {
    const results = realm
      .objects('ActivityLog')
      .filtered(
        'category IN $0',
        categories.length > 0 ? categories : ['uncategorized']
      );
    return results.map((log: any) => {
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
  try {
    console.log(`Synchronizing ActivityLog for UID: ${uid}`);
    const globalLogs = realm.objects('ActivityLog').filtered('uid == $0', uid);
    const userLogs = realm.objects('ActivityLog').filtered('uid == $0', uid);
    realm.write(() => {
      globalLogs.forEach((log: any) => {
        const exists = userLogs.some((userLog: any) => userLog.id === log.id);
        if (!exists) {
          realm.create('ActivityLog', { ...log, uid });
        }
      });
      userLogs.forEach((log: any) => {
        const exists = globalLogs.some(
          (globalLog: any) => globalLog.id === log.id
        );
        if (!exists) {
          realm.create('ActivityLog', { ...log, uid });
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
  try {
    console.log(`Synchronizing Discussions for UID: ${uid}`);
    const globalDiscussions = realm
      .objects('Discussion')
      .filtered('uid == $0', uid);
    const userDiscussions = realm
      .objects('Discussion')
      .filtered('uid == $0', uid);
    realm.write(() => {
      globalDiscussions.forEach((discussion: any) => {
        const exists = userDiscussions.some(
          (userDiscussion: any) => userDiscussion.id === discussion.id
        );
        if (!exists) {
          realm.create('Discussion', { ...discussion, uid });
        }
      });
      userDiscussions.forEach((discussion: any) => {
        const exists = globalDiscussions.some(
          (globalDiscussion: any) => globalDiscussion.id === discussion.id
        );
        if (!exists) {
          realm.create('Discussion', { ...discussion, uid });
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
      const discussion = realm.objectForPrimaryKey('Discussion', discussionId);
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
  try {
    realm.write(() => {
      const discussions = realm
        .objects('Discussion')
        .filtered('description == null || description == ""');
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
  try {
    realm.write(() => {
      const discussion = realm.objectForPrimaryKey('Discussion', id);
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
  try {
    let discussions = realm
      .objects('Discussion')
      .filtered('uid == $0', uid)
      .sorted('timestamp', true);
    if (discussionId) {
      const discussion = realm.objectForPrimaryKey(
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
        .objects('Discussion')
        .filtered(
          `id IN {${discussions
            .slice(0, lastX)
            .map((d) => d.id)
            .join(',')}}`
        )
        .sorted('timestamp', true);
    }
    return discussions.map((doc: any) => ({
      id: doc.id,
      discussionId: doc.discussionId,
      description: doc.description,
      typeSay: doc.typeSay,
      cleared: doc.cleared,
      timestamp: format(new Date(doc.timestamp as Date), 'M/d/yy \n h:mm a'),
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
  try {
    realm.write(() => {
      const discussion = realm.objectForPrimaryKey('Discussion', id);
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
  try {
    const discussions = realm
      .objects('Discussion')
      .filtered('uid == $0', uid)
      .sorted('timestamp', true);
    if (discussions.length > 0) {
      const doc = discussions[0];
      return {
        id: doc.id,
        discussionId: doc.discussionId || doc.id,
        description: doc.description,
        timestamp: new Date(doc.timestamp as Date),
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
  try {
    let discussions = realm
      .objects('Discussion')
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
  try {
    const discussions = realm
      .objects('Discussion')
      .filtered('typeSay == "tell" AND cleared == false AND uid == $0', uid);
    if (discussions.length === 0) {
      console.log('No pending tell statements to process.');
      return;
    }
    const rules = await getRules();
    realm.write(() => {
      discussions.forEach((doc: any) => {
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
        realm.create('ActivityLog', {
          id: new Date().getTime(),
          discussionId: doc.id,
          description: doc.description,
          category,
          timestamp: doc.timestamp,
          cleared: false,
          uid,
        });
        doc.cleared = true;
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
      realm.create('GPTResponses', {
        id,
        timestamp: new Date(),
        discussionId: Number(discussionId),
        prompt: question,
        response: JSON.stringify(response),
        responseType: 'parsed question',
        cleared: false,
        uid,
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
  try {
    let hasMore = true;
    while (hasMore) {
      const responses = realm
        .objects('GPTResponses')
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
      const responseJson = JSON.parse(gptResponse.response as string) as {
        category: string;
        parsedDescription: string;
      };
      const discussionId = gptResponse.discussionId;
      const timestamp = new Date(gptResponse.timestamp as unknown as Date);
      const activityLog = realm
        .objects('ActivityLog')
        .filtered('discussionId == $0', discussionId)[0];
      realm.write(() => {
        if (activityLog) {
          activityLog.category = responseJson.category;
          activityLog.description = responseJson.parsedDescription;
          activityLog.responseType = 'tell';
          activityLog.cleared = true;
        } else {
          realm.create('ActivityLog', {
            id: new Date().getTime(),
            discussionId,
            category: responseJson.category,
            description: responseJson.parsedDescription,
            timestamp,
            cleared: true,
            uid,
          });
        }
        gptResponse.cleared = true;
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
  try {
    realm.write(() => {
      const discussion = realm.objectForPrimaryKey(
        'Discussion',
        Number(discussionId)
      );
      if (discussion) {
        discussion.cleared = true;
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
  try {
    realm.write(() => {
      const discussion = realm.objectForPrimaryKey(
        'Discussion',
        Number(discussionId)
      );
      if (discussion) {
        discussion.cleared = true;
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
  try {
    // Explicitly type the Realm query result
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
      // Validate and convert timestamp
      const timestampValue = gptResponse.timestamp;
      const timestamp =
        timestampValue instanceof Date
          ? timestampValue
          : typeof timestampValue === 'string' ||
            typeof timestampValue === 'number'
          ? new Date(timestampValue)
          : new Date(); // Fallback to current date if invalid
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
        .objects('ActivityLog')
        .filtered('discussionId == $0', discussionId)[0];
      realm.write(() => {
        if (activityLog) {
          activityLog.category = category;
          activityLog.description = parsedDescription;
          activityLog.responseType = 'tell';
          activityLog.cleared = true;
        } else {
          realm.create('ActivityLog', {
            id: new Date().getTime(),
            discussionId,
            category,
            description: parsedDescription,
            timestamp,
            cleared: true,
            uid,
          });
        }
        gptResponse.cleared = true;
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
  try {
    realm.write(() => {
      const discussions = realm
        .objects('Discussion')
        .filtered('uid == $0', uid);
      discussions.forEach((doc: any) => {
        const fieldName = Object.keys(doc).find(
          (key) => key.toLowerCase() === 'cleared'
        );
        if (fieldName && fieldName !== 'cleared') {
          doc.cleared = doc[fieldName];
          delete doc[fieldName];
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
  try {
    const discussions = realm
      .objects('Discussion')
      .filtered(
        'cleared == false AND description != null AND description != "" AND uid == $0',
        uid
      )
      .sorted('timestamp', true);
    if (discussions.length > 0) {
      const discussion = discussions[0];
      return {
        id: String(discussion.id),
        description: discussion.description as string,
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
  try {
    const discussion = realm.objectForPrimaryKey(
      'Discussion',
      Number(discussionId)
    );
    if (!discussion) {
      console.log(`No discussion found with ID: ${discussionId}`);
      return undefined;
    }
    const gptResponse = realm.objectForPrimaryKey(
      'GPTResponses',
      Number(GPT_ResponseId)
    );
    if (!gptResponse) {
      console.error('GPT Response not found');
      return undefined;
    }
    const parsedQuestion = JSON.parse(gptResponse.response as string);
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
        realm.create('GPTResponses', {
          id: new Date().getTime(),
          timestamp: new Date(),
          prompt: question,
          response: response,
          responseType: 'gpt response',
          discussionId: Number(discussionId),
          cleared: false,
          uid,
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
  try {
    const id = new Date().getTime();
    realm.write(() => {
      realm.create('GPTResponses', {
        id,
        discussionId: Number(discussionId),
        response,
        responseType,
        timestamp: new Date(),
        cleared,
        uid,
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
  try {
    const responses = realm
      .objects('GPTResponses')
      .filtered('discussionId == $0 AND uid == $1', Number(discussionId), uid);
    return responses.map((doc: any) => doc);
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
    const responses = realm
      .objects('GPTResponses')
      .filtered(
        'discussionId == $0 AND responseType == "parsed answer" AND uid == $1',
        Number(discussionId),
        uid
      );
    return responses.map((doc: any) => doc.response);
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
  try {
    realm.write(() => {
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
  try {
    const alerts = realm
      .objects('Alert')
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
  try {
    realm.write(() => {
      const existingAlert = alertData._id
        ? realm.objectForPrimaryKey('Alert', alertData._id)
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
  try {
    realm.write(() => {
      const alert = realm.objectForPrimaryKey('Alert', key);
      if (alert) {
        alert.isActive = false;
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
  try {
    const specialty = realm
      .objects('GPTSpecialties')
      .filtered('name == $0', gpt_name)[0];
    return specialty
      ? { url: specialty.url as string, apiKey: specialty.apiKey as string }
      : null;
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
      for (const entry of lostData) {
        const id = Number(entry.id);
        const existing = realm.objectForPrimaryKey('ActivityLog', id);
        if (!existing) {
          realm.create('ActivityLog', {
            id,
            discussionId: id,
            description: entry.description,
            category: 'uncategorized',
            timestamp: new Date(entry.timestamp),
            cleared: false,
            uid,
          });
          console.log(`Restored document: ${entry.id}`);
        }
      }
    });
    console.log('Data restoration completed!');
  } catch (error) {
    console.error('Error restoring lost data:', error);
  }
}

export async function getRules(): Promise<Rule[]> {
  try {
    const rules = realm.objects('Rule').map((rule: any) => ({
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

export class DatabaseService {
  async parseAndSaveInstructions(jsonData: any): Promise<void> {
    try {
      const instructions = jsonData.instructions;
      realm.write(() => {
        for (const instruction of instructions) {
          const discussion = realm
            .objects('Discussion')
            .filtered('id == $0', instruction.id)[0];
          if (discussion) {
            const timestamp = new Date(discussion.timestamp as Date);
            const existingLog = realm
              .objects('ActivityLog')
              .filtered('timestamp == $0', timestamp)[0];
            if (existingLog) {
              existingLog.category = instruction.category;
              existingLog.description = instruction.description;
            } else {
              realm.create('ActivityLog', {
                id: new Date().getTime(),
                discussionId: discussion.id,
                category: instruction.category,
                description: instruction.description,
                timestamp,
                cleared: false,
                uid: discussion.uid,
              });
            }
          }
        }
      });
    } catch (error) {
      console.error('Error parsing and saving instructions:', error);
    }
  }

  async getDiscussionById(id: string): Promise<Discussion | null> {
    try {
      const discussion = realm.objectForPrimaryKey('Discussion', Number(id));
      return discussion
        ? {
            id: Number(discussion.id),
            discussionId: Number(discussion.discussionId), // Ensure discussionId is a number
            description: discussion.description as string,
            timestamp: discussion.timestamp as Date,
            typeSay: discussion.typeSay as string,
            cleared: discussion.cleared as boolean, // Fixed typo from 'typleared'
            synced: discussion.synced as boolean,
            syncTimestamp: discussion.syncTimestamp as Date,
          }
        : null;
    } catch (error) {
      console.error('Error getting discussion by ID:', error);
      return null;
    }
  }
  async getExistingLog(timestamp: Date): Promise<ActivityLog | null> {
    try {
      const log = realm
        .objects('ActivityLog')
        .filtered('timestamp == $0', timestamp)[0];
      return log
        ? {
            id: Number(log.id),
            discussionId: Number(log.discussionId),
            category: log.category as string,
            description: log.description as string,
            timestamp: log.timestamp as Date,
            cleared: log.cleared as boolean,
            responseType: log.responseType as string,
          }
        : null;
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
    try {
      realm.write(() => {
        const existingLog = realm.objectForPrimaryKey('ActivityLog', log.id);
        if (existingLog) {
          existingLog.category = log.category;
          existingLog.description = log.description;
          existingLog.timestamp = log.timestamp;
          existingLog.cleared = log.cleared;
          existingLog.responseType = log.responseType;
          console.log(`Updated ActivityLog ${log.id}`);
        }
      });
    } catch (error) {
      console.error('Error updating ActivityLog:', error);
    }
  }

  async addActivityLog(log: ActivityLog): Promise<void> {
    try {
      realm.write(() => {
        realm.create('ActivityLog', {
          id: log.id,
          discussionId: log.discussionId,
          category: log.category,
          description: log.description,
          timestamp: log.timestamp,
          cleared: log.cleared,
          responseType: log.responseType,
          uid: log.uid,
        });
        console.log(`Added ActivityLog ${log.id}`);
      });
    } catch (error) {
      console.error('Error adding ActivityLog:', error);
    }
  }
}

function deleteGPTResponsesWithInvalidCategory(): void {
  realm.write(() => {
    const gptResponses = realm.objects('GPTResponses');
    gptResponses.forEach((gptResponse: any) => {
      try {
        const responseJson = JSON.parse(gptResponse.response);
        if (!responseJson.category) {
          realm.delete(gptResponse);
        }
      } catch (error) {
        console.error('Error parsing GPT response:', error);
      }
    });
  });
}

export async function updateGPTSpecialties(gptSpecialty: {
  id?: number;
  name: string;
  url: string;
  apiKey: string;
}): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for update GPT specialties operation');
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
        ? realm.objectForPrimaryKey('GPTSpecialties', gptSpecialty.id)
        : null;
      if (existing) {
        existing.name = gptSpecialty.name;
        existing.url = gptSpecialty.url;
        existing.apiKey = gptSpecialty.apiKey;
      } else {
        realm.create('GPTSpecialties', {
          id: new Date().getTime(),
          name: gptSpecialty.name,
          url: gptSpecialty.url,
          apiKey: gptSpecialty.apiKey,
        });
      }
    });
    console.log('GPT Specialty updated:', response.data);
  } catch (error) {
    console.error('Error updating GPT specialty:', error);
    throw error;
  }
}

export function getActivityLogs(): ActivityLog[] {
  return Array.from(realm.objects('ActivityLog'));
}

export function getParameters(): Parameters[] {
  return Array.from(realm.objects('Parameters'));
}

export async function getDescriptionsWithTimestamps(
  categories: string[]
): Promise<string> {
  try {
    const logs = realm
      .objects('ActivityLog')
      .filtered('category IN $0', categories);
    const descriptionsWithTimestamps = logs.map((log: any) => ({
      description: log.description,
      timestamp: log.timestamp.toISOString(),
    }));
    return JSON.stringify(descriptionsWithTimestamps);
  } catch (error) {
    console.error('Error getting descriptions with timestamps:', error);
    return '[]';
  }
}

// Interface for User schema (matches realmConfig.ts)
interface User {
  id: string;
  appVersion: string;
  appId: string;
  timestamp: Date;
  uid: string;
  isPaid: boolean;
}

export async function isPaidUser(): Promise<boolean> {
  const uid = await getUID();
  if (!uid) return false;
  try {
    const user = realm.objects<User>('User').filtered('uid == $0', uid)[0];
    return user?.isPaid ?? false;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
}

// ... other exports (e.g., addOrUpdateActivityLog, getDistinctCategories)

export {
  type ActivityLog,
  type Discussion,
  type GPTSpecialty,
  type GPTResponse,
  type Alert,
};
