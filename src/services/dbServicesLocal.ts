import Realm, { UpdateMode } from 'realm';
import { realm } from '../realmConfig';
import {
  GPTResponsesSchema,
  GPTSpecialtiesSchema,
  ActivityLogSchema,
  DiscussionSchema,
  AlertSchema,
  ParametersSchema,
  CategorySchema,
} from '../realmConfig';
import { sendQuestion, sendQuestionForParsing } from './openaiAPI';
import { getUID } from '../utils/uidManager';
import { format } from 'date-fns';
// REMOVE: import { addOrUpdateDiscussion as addOrUpdateDiscussionRouter } from './dbServices';
import React, { useContext } from 'react';
import { SettingsContext } from '../../app/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as remote from './dbServicesRemote';
import { ENABLE_DISCUSSION_SYNC, ENABLE_ACTIVITYLOG_SYNC } from './syncConfig';
import { ActivityLog, Discussion } from './types';
import { addOrUpdateDiscussion as addOrUpdateDiscussionRouter } from './dbServices';

const APP_VERSION = '1.1.0';
const APP_ID = 'com.anonymous.lifelog';

// Interfaces matching realmConfig.ts schemas
interface User {
  id: string;
  appVersion: string;
  appId: string;
  timestamp: Date;
  isPaid: boolean;
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
  id: string;
  name: string;
  url: string;
  apiKey: string;
  synced?: boolean;
}

interface GPTResponse {
  id: string;
  discussionId: string;
  timestamp: Date;
  prompt: string;
  response: string;
  responseType: string;
  cleared: boolean;
  synced: boolean;
  syncTimestamp?: Date;
}

interface Alert {
  id: string;
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
  id: string;
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

interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
  syncTimestamp?: Date;
  uid: string;
}

function compareVersions(v1: string, v2: string): boolean {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  return false;
}

// src/services/dbServicesLocal.ts
// ... existing imports and interfaces ...
//import Realm from 'realm';

interface SyncEntry {
  id: string;
  tableName: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: Date;
}

export const findDuplicateActivityLog = (
  discussionId: string,
  category: string,
  description: string
): ActivityLog | null => {
  if (!realm) throw new Error('Realm not initialized');
  console.log(
    `Checking for duplicate ActivityLog: ${discussionId}, ${category}, ${description.substring(
      0,
      50
    )}...`
  );

  try {
    // First check for exact matches
    let logs = realm
      ?.objects<ActivityLog>('ActivityLog')
      .filtered(
        'discussionId == $0 AND category == $1 AND description == $2',
        discussionId,
        category,
        description
      );

    if (logs && logs.length > 0) {
      const log = logs[0];
      console.log(`Found exact duplicate ActivityLog: ${log.id}`);
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
        uid: (log as any).uid || 'local_user',
        lockedCategory: (log as any).lockedCategory || false,
        lockedDescription: (log as any).lockedDescription || false,
        categoryId: (log as any).categoryId,
      } as ActivityLog;
    }

    // Check for recent duplicates with same discussionId and category (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    logs = realm
      ?.objects<ActivityLog>('ActivityLog')
      .filtered(
        'discussionId == $0 AND category == $1 AND timestamp > $2',
        discussionId,
        category,
        fiveMinutesAgo
      );

    if (logs && logs.length > 0) {
      // Check if any recent logs have very similar descriptions (> 80% similar)
      for (const log of Array.from(logs)) {
        const similarity = calculateStringSimilarity(
          log.description,
          description
        );
        if (similarity > 0.8) {
          console.log(
            `Found similar recent ActivityLog (${Math.round(
              similarity * 100
            )}% similar): ${log.id}`
          );
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
            uid: (log as any).uid || 'local_user',
            lockedCategory: (log as any).lockedCategory || false,
            lockedDescription: (log as any).lockedDescription || false,
            categoryId: (log as any).categoryId,
          } as ActivityLog;
        }
      }
    }

    console.log('No duplicate ActivityLog found');
    return null;
  } catch (error) {
    console.error('Error finding duplicate ActivityLog:', error);
    throw error;
  }
};

// Helper function to calculate string similarity
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Logs a synchronization entry to the Realm database.
 *
 * This function writes a new `SyncEntry` object to the Realm database, recording
 * details about a synchronization event such as the table name, operation type,
 * and timestamp. It handles cases where the Realm instance is not initialized
 * and includes error handling for write operations.
 *
 * @param entry - The `SyncEntry` object containing information about the synchronization event to be logged.
 * @returns A promise that resolves when the entry has been successfully logged to Realm, or rejects if an error occurs.
 *
 * @throws Will throw an error if the Realm write operation fails.
 */
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
      }, UpdateMode.Modified); // Use UpdateMode.Modified to update existing entries
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
        console.log('User already initialized');
        // Only update non-primary key fields
        existingUser.appVersion = userData.appVersion;
        existingUser.appId = userData.appId;
        existingUser.timestamp = userData.timestamp;
        existingUser.isPaid = userData.isPaid;
      } else {
        console.log('Initializing user');
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
    const id = Date.now().toString();
    realm?.write(() => {
      realm?.create('Document', {
        id,
        ...data,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(), // Use provided timestamp if available
        synced: false,
      });
    });
    console.log('Document created with ID:', id);
    return id;
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
      const doc = realm?.objectForPrimaryKey('Document', docId);
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
      const doc = realm?.objectForPrimaryKey('Document', docId);
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
  // console.log('Getting distinct categories...');
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
    // console.log('Categories:', categories);
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
  // console.log('Querying all fields by categories:', categories);
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

export async function synchronizeCategories(appVersion: string): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }

  console.log(`Synchronizing Categories for local Realm...`);

  try {
    // Get all unique categories from ActivityLog entries
    const activityLogCategories = Array.from(
      new Set(
        realm
          ?.objects<ActivityLog>('ActivityLog')
          ?.map((item) => item.category)
          .filter((cat) => cat && cat !== 'uncategorized')
      )
    );

    // Sync categories to the Category table
    realm?.write(() => {
      activityLogCategories.forEach((categoryName) => {
        const existing = realm
          ?.objects('Category')
          .filtered('name == $0', categoryName)[0];

        if (!existing) {
          const id = Date.now().toString() + '_' + categoryName;
          realm?.create('Category', {
            id,
            name: categoryName,
            description: `Auto-generated category for ${categoryName}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            synced: false,
            uid: 'local_user',
          });
          console.log(`Created category: ${categoryName}`);
        } else {
          // Update existing category timestamp
          existing.updatedAt = new Date();
          existing.synced = false;
          console.log(`Updated category: ${categoryName}`);
        }
      });
    });

    console.log('Category synchronization completed.');
  } catch (error) {
    console.error('Error synchronizing Categories:', error);
    throw error;
  }
}

export async function getCategoryById(id: string): Promise<Category | null> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    return null;
  }
  try {
    const category = realm.objectForPrimaryKey<Category>('Category', id);
    if (category) {
      return {
        id: category.id,
        name: category.name,
        description: category.description,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        synced: category.synced,
        syncTimestamp: category.syncTimestamp,
        uid: category.uid,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error getting category by id ${id}:`, error);
    return null;
  }
}

export async function getCategories(): Promise<Category[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const categories = realm.objects<Category>('Category');
    return Array.from(categories).map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      synced: cat.synced,
      syncTimestamp: cat.syncTimestamp,
      uid: cat.uid,
    }));
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
}

export async function getCategoryNames(): Promise<string[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const categories = realm.objects<Category>('Category');
    return Array.from(categories).map((cat) => cat.name);
  } catch (error) {
    console.error('Error getting category names:', error);
    throw error;
  }
}

export async function addOrUpdateCategory(
  name: string,
  description?: string,
  id?: string
): Promise<string> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    let categoryId = id;
    const currentUID = await getUID() || 'local_user';
    
    realm.write(() => {
      if (id) {
        const existing = realm?.objectForPrimaryKey<Category>('Category', id);
        if (existing) {
          existing.name = name;
          existing.description = description;
          existing.updatedAt = new Date();
          existing.synced = false;
          existing.uid = currentUID; // Update UID
        }
      } else {
        categoryId = Date.now().toString() + '_' + name;
        realm?.create('Category', {
          id: categoryId,
          name,
          description: description || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: false,
          uid: currentUID,
        });
      }
    });
    return categoryId!;
  } catch (error) {
    console.error('Error adding/updating category:', error);
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const category = realm?.objectForPrimaryKey('Category', id);
      if (category) {
        realm?.delete(category);
      }
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const logs = realm.objects<ActivityLog>('ActivityLog');
    return Array.from(logs).map((log) => ({
      id: log.id,
      discussionId: log.discussionId,
      category: log.category,
      description: log.description,
      timestamp: log.timestamp,
      cleared: log.cleared,
      responseType: log.responseType || '',
      synced: log.synced || false,
      syncTimestamp: log.syncTimestamp,
      categoryId: (log as any).categoryId,
      uid: (log as any).uid || 'local_user',
      lockedCategory: (log as any).lockedCategory || false,
      lockedDescription: (log as any).lockedDescription || false,
    }));
  } catch (error) {
    console.error('Error getting activity logs:', error);
    throw error;
  }
}

export async function getDiscussions(
  lastX?: number,
  discussionId?: string
): Promise<Discussion[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    let discussions = realm.objects<Discussion>('Discussion');

    if (discussionId) {
      discussions = discussions.filtered('discussionId == $0', discussionId);
    }

    let results = Array.from(discussions).map((disc) => ({
      id: disc.id,
      discussionId: disc.discussionId,
      description: disc.description,
      timestamp: disc.timestamp,
      typeSay: disc.typeSay,
      cleared: disc.cleared,
      uid: disc.uid,
    }));

    if (lastX) {
      results = results.slice(-lastX);
    }

    return results;
  } catch (error) {
    console.error('Error getting discussions:', error);
    throw error;
  }
}

export async function addOrUpdateDiscussion(
  description: string,
  typeSay: string = 'tell',
  id?: string
): Promise<string> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    let discussionId = id;
    realm.write(() => {
      if (id) {
        const existing = realm?.objectForPrimaryKey<Discussion>(
          'Discussion',
          id
        );
        if (existing) {
          existing.description = description;
          existing.typeSay = typeSay;
          existing.timestamp = new Date();
        }
      } else {
        discussionId = Date.now().toString();
        realm?.create('Discussion', {
          id: discussionId,
          discussionId: discussionId,
          description,
          timestamp: new Date(),
          typeSay,
          cleared: false,
          uid: 'local_user',
        });
      }
    });
    return discussionId!;
  } catch (error) {
    console.error('Error adding/updating discussion:', error);
    throw error;
  }
}

export async function deleteDiscussion(id: string): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const discussion = realm?.objectForPrimaryKey('Discussion', id);
      if (discussion) {
        realm?.delete(discussion);
      }
    });
  } catch (error) {
    console.error('Error deleting discussion:', error);
    throw error;
  }
}

export async function createActivityLog(
  activityLog: Omit<ActivityLog, 'id'>
): Promise<string> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }

  try {
    // Check for existing duplicate before creating
    const existingLog = findDuplicateActivityLog(
      activityLog.discussionId,
      activityLog.category,
      activityLog.description
    );

    if (existingLog) {
      console.log(
        `Duplicate ActivityLog found, returning existing ID: ${existingLog.id}`
      );
      return existingLog.id;
    }

    // Generate a more unique ID to prevent collisions
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    realm.write(() => {
      realm?.create('ActivityLog', {
        id,
        ...activityLog,
        synced: false,
      });
    });

    console.log(`Created new ActivityLog with ID: ${id}`);
    return id;
  } catch (error) {
    console.error('Error creating activity log:', error);
    throw error;
  }
}

export async function deleteActivityLog(activityLogId: string): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const log = realm?.objectForPrimaryKey('ActivityLog', activityLogId);
      if (log) {
        realm?.delete(log);
      }
    });
  } catch (error) {
    console.error('Error deleting activity log:', error);
    throw error;
  }
}

export async function updateActivityLogCategory(
  activityLogId: string,
  category: string
): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const log = realm?.objectForPrimaryKey('ActivityLog', activityLogId);
      if (log) {
        (log as any).category = category;
      }
    });
  } catch (error) {
    console.error('Error updating activity log category:', error);
    throw error;
  }
}

export async function markDiscussionAsCleared(
  discussionId: string
): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const discussion = realm?.objectForPrimaryKey('Discussion', discussionId);
      if (discussion) {
        (discussion as any).cleared = true;
      }
    });
  } catch (error) {
    console.error('Error marking discussion as cleared:', error);
    throw error;
  }
}

// Add placeholder functions for missing ones
export async function fetchInitialDiscussion(): Promise<any | null> {
  return null;
}

export async function getNextOpenDiscussion(
  lastVisibleId?: string
): Promise<any> {
  return { snapshot: [], hasMore: false, lastVisibleDoc: null };
}

export async function processPendingTells(): Promise<void> {
  if (!realm) {
    console.error('Realm instance not available');
    return;
  }

  try {
    console.log('Processing pending tell statements...');
    
    // Get all uncleared "tell" discussions
    const discussions = realm.objects<Discussion>('Discussion');
    const pendingTells = discussions.filtered('typeSay == "tell" AND cleared == false');
    
    if (pendingTells.length === 0) {
      console.log('No pending tell statements to process.');
      return;
    }

    console.log(`Found ${pendingTells.length} pending tell statements`);

    // Get available categories for rule processing
    const categories = await getCategoryNames();
    
    for (const discussion of pendingTells) {
      console.log('Processing tell:', discussion.description);

      // Check if ActivityLog already exists for this discussion
      const existingActivityLog = realm.objects<ActivityLog>('ActivityLog')
        .filtered('discussionId == $0', discussion.id);
      
      if (existingActivityLog.length > 0) {
        console.log('ActivityLog already exists for discussion:', discussion.id);
        // Mark discussion as cleared
        realm.write(() => {
          discussion.cleared = true;
        });
        continue;
      }

      // Import processPhrase to apply rules and get category
      const { processPhrase } = require('./phraseProcessor');
      
      try {
        // Use processPhrase to determine category and description
        const result = await processPhrase(
          discussion.description,
          categories,
          [], // discussionCounts - empty for this use case
          () => {}, // setDiscussionCounts - noop function
          discussion.id,
          discussion.uid || 'local-user'
        );

        // Create ActivityLog entry
        await createActivityLog({
          discussionId: discussion.id,
          description: result.parsedDescription || discussion.description,
          category: result.category || 'general',
          uid: discussion.uid || 'local-user',
          timestamp: discussion.timestamp || new Date(),
          cleared: false,
          lockedCategory: false,
          lockedDescription: false,
        });

        console.log(`Created ActivityLog for discussion ${discussion.id} with category: ${result.category}`);

        // Mark discussion as cleared
        realm.write(() => {
          discussion.cleared = true;
        });

      } catch (error) {
        console.error('Error processing tell statement:', discussion.description, error);
      }
    }

    console.log('Finished processing pending tell statements');
  } catch (error) {
    console.error('Error in processPendingTells:', error);
  }
}

export async function addQuestionDiscussion(
  question: string,
  discussionId: string
): Promise<void> {
  // Placeholder
}

export async function processUnclearedGPTResponses(): Promise<void> {
  // Placeholder
}

export async function clearDiscussion(discussionId: string): Promise<boolean> {
  await markDiscussionAsCleared(discussionId);
  return true;
}

export async function addOrUpdateActivityLog(): Promise<void> {
  // Placeholder
}

export async function renameFieldToCleared(): Promise<void> {
  // Placeholder
}

export async function getLastOpenDiscussion(): Promise<any> {
  return { id: '', description: '' };
}

export async function disperseQuestion(
  discussionId: string,
  gptResponseId: string
): Promise<string[] | undefined> {
  return undefined;
}

export async function addOrUpdateGPTResponse(
  discussionId: string,
  response: string,
  responseType: string,
  cleared: boolean = false
): Promise<void> {
  // Placeholder
}

export async function getGPTResponses(discussionId: string): Promise<any[]> {
  return [];
}

export async function getParsedGPTResponses(
  discussionId: string
): Promise<string[]> {
  return [];
}

export async function getAIResponse(question: string): Promise<string> {
  return '';
}

export async function syncToCloud(
  tableName: string,
  payload?: any,
  method?: string
): Promise<void> {
  console.log(`Local syncToCloud called for table: ${tableName}`);
  
  if (!realm) {
    console.error('Realm not initialized for sync');
    return;
  }

  try {
    // Get unsynced records for the specified table
    const unsyncedRecords = realm.objects(tableName).filtered('synced == false');
    console.log(`Found ${unsyncedRecords.length} unsynced ${tableName} records`);
    
    if (unsyncedRecords.length === 0) {
      console.log(`No unsynced ${tableName} records to sync`);
      return;
    }

    // Convert Realm objects to plain objects for syncing
    const recordsToSync = Array.from(unsyncedRecords).map((record: any) => ({
      ...record,
      // Convert dates to ISO strings for Firestore
      createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt || Date.now()),
      updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt || Date.now()),
    }));

    // Import remote services for syncing (use require for compatibility)
    const remote = require('./dbServicesRemote');
    
    // Sync records to Firestore
    const syncedIds = await remote.syncRealmRowsToFirestore(tableName, recordsToSync);
    console.log(`Successfully synced ${syncedIds.length} ${tableName} records to Firestore`);

    // Mark synced records as synced in Realm
    if (realm) {
      realm.write(() => {
        for (const syncedId of syncedIds) {
          const record = realm!.objectForPrimaryKey(tableName, syncedId);
          if (record) {
            (record as any).synced = true;
          }
        }
      });
    }

    console.log(`Marked ${syncedIds.length} ${tableName} records as synced in Realm`);
  } catch (error) {
    console.error(`Error syncing ${tableName} to cloud:`, error);
    throw error;
  }
}

export async function getNextActiveAlert(): Promise<any | null> {
  return null;
}

export async function addOrUpdateAlert(alertData: any): Promise<void> {
  // Placeholder
}

export async function deactivateAlertByKey(key: number): Promise<void> {
  // Placeholder
}

export async function getURLofGPT(gpt_name: string): Promise<any | null> {
  return null;
}

export async function expandFromAbbreviation(
  discussion: string
): Promise<string> {
  return discussion;
}

export async function restoreLostData(): Promise<void> {
  // Placeholder
}

export async function getRules(): Promise<any[]> {
  return [];
}

export async function updateGPTSpecialties(gptSpecialty: any): Promise<void> {
  // Placeholder
}

export async function getParameters(): Promise<any[]> {
  return [];
}

export async function getDescriptionsWithTimestamps(
  categories: string[]
): Promise<string> {
  return '[]';
}

export async function createRuleCandidate(data: any): Promise<void> {
  // Placeholder
}

export async function readChangeLog(filter: any): Promise<any[]> {
  return [];
}

export async function syncTableFromRemote(
  tableName: string,
  newRows: any[]
): Promise<void> {
  // Placeholder
}

export async function logChange(
  tableName: string,
  rowId: string,
  operation: string
): Promise<void> {
  // Placeholder
}

export async function deleteAllLocalRows(): Promise<void> {
  // Placeholder
}

export async function addChangeLogEntry(
  tableName: string,
  rowId: string,
  operation: 'create' | 'update' | 'delete',
  timestamp?: Date
): Promise<void> {
  if (!realm) {
    console.warn('Realm not initialized, skipping ChangeLog entry');
    return;
  }
  try {
    const ts = timestamp || new Date();
    realm.write(() => {
      realm?.create('ChangeLog', {
        id: `${tableName}_${rowId}_${ts.getTime()}`,
        tableName,
        rowId,
        operation,
        timestamp: ts,
        synced: false,
      });
    });
    console.log(`Added ChangeLog entry: ${tableName} ${rowId} ${operation}`);
  } catch (error) {
    console.error('Error adding ChangeLog entry:', error);
    throw error;
  }
}

export async function importLegacyDiscussions(
  discussions: any[]
): Promise<number> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  let count = 0;
  try {
    realm.write(() => {
      discussions.forEach((discussion: any) => {
        realm?.create('Discussion', {
          id: discussion.id || Date.now().toString(),
          discussionId: discussion.discussionId || discussion.id,
          description: discussion.description || '',
          timestamp: discussion.timestamp || new Date(),
          typeSay: discussion.typeSay || 'tell',
          cleared: discussion.cleared || false,
          uid: discussion.uid || 'legacy_user',
        });
        count++;
      });
    });
    console.log(`Imported ${count} legacy discussions`);
  } catch (error) {
    console.error('Error importing legacy discussions:', error);
    throw error;
  }
  return count;
}

export async function importLegacyActivityLogs(
  activityLogs: any[]
): Promise<number> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  let count = 0;
  try {
    realm.write(() => {
      activityLogs.forEach((log: any) => {
        realm?.create('ActivityLog', {
          id: log.id || Date.now().toString(),
          discussionId: log.discussionId || '',
          category: log.category || 'uncategorized',
          description: log.description || '',
          timestamp: log.timestamp || new Date(),
          cleared: log.cleared || false,
          responseType: log.responseType || '',
          synced: false,
          uid: log.uid || 'legacy_user',
        });
        count++;
      });
    });
    console.log(`Imported ${count} legacy activity logs`);
  } catch (error) {
    console.error('Error importing legacy activity logs:', error);
    throw error;
  }
  return count;
}

export async function ensureStringIds(tableName: string): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const objects = realm?.objects(tableName);
      if (objects) {
        objects.forEach((obj: any) => {
          if (typeof obj.id !== 'string') {
            obj.id = String(obj.id);
          }
        });
      }
    });
    console.log(`Ensured string IDs for ${tableName}`);
  } catch (error) {
    console.error(`Error ensuring string IDs for ${tableName}:`, error);
    throw error;
  }
}

export async function populateCategoryId(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  console.log('Starting to populate categoryId in ActivityLog...');
  try {
    realm.write(() => {
      const activityLogs = realm?.objects('ActivityLog');
      const categories = realm?.objects('Category');
      const categoryMap = new Map();

      if (categories) {
        categories.forEach((c: any) => {
          categoryMap.set(c.name, c.id);
        });
      }

      if (activityLogs) {
        activityLogs.forEach((log: any) => {
          if (!log.categoryId && log.category) {
            const categoryId = categoryMap.get(log.category);
            if (categoryId) {
              log.categoryId = categoryId;
            }
          }
        });
      }
    });
    console.log('Finished populating categoryId in ActivityLog.');
  } catch (error) {
    console.error('Error populating categoryId in ActivityLog:', error);
    throw error;
  }
}

export async function createCategoriesFromLogs(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const activityLogs = realm?.objects('ActivityLog');
      const categories = realm?.objects('Category');
      const categorySet = new Set();

      // Collect unique categories from ActivityLog
      if (activityLogs) {
        activityLogs.forEach((log: any) => {
          if (log.category && log.category !== 'uncategorized') {
            categorySet.add(log.category);
          }
        });
      }

      // Create or update categories in the Category table
      categorySet.forEach((categoryName) => {
        let category;
        if (categories) {
          category = categories.filtered('name == $0', categoryName)[0];
        }
        if (!category) {
          // Create new category
          const id = new Date().getTime() + '_' + categoryName;
          realm?.create('Category', {
            id,
            name: categoryName,
            description: `Auto-generated category for ${categoryName}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            synced: false,
            uid: 'local_user',
          });
          console.log(`Created category: ${categoryName}`);
        } else {
          // Update existing category
          (category as any).updatedAt = new Date();
          (category as any).synced = false;
          console.log(`Updated category: ${categoryName}`);
        }
      });
    });
  } catch (error) {
    console.error('Error creating categories from logs:', error);
    throw error;
  }
}

export async function printAllRealmDataToTerminal(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    return;
  }
  try {
    console.log('=== REALM DATA DUMP ===');

    // Print all tables
    const schemaNames = [
      'Discussion',
      'ActivityLog',
      'Category',
      'GPTResponse',
      'Alert',
      'User',
    ];

    for (const tableName of schemaNames) {
      try {
        const objects = realm.objects(tableName);
        console.log(`\n--- ${tableName} (${objects.length} records) ---`);
        Array.from(objects).forEach((obj: any, index: number) => {
          console.log(`${index + 1}:`, JSON.stringify(obj, null, 2));
        });
      } catch (error) {
        console.warn(`Could not read ${tableName}:`, error);
      }
    }

    console.log('\n=== END REALM DATA DUMP ===');
  } catch (error) {
    console.error('Error printing realm data:', error);
  }
}

export async function debugPrintAllActivityLogs(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    return;
  }
  try {
    const logs = realm.objects('ActivityLog');
    console.log(`=== ACTIVITY LOGS (${logs.length} records) ===`);
    Array.from(logs).forEach((log: any, index: number) => {
      console.log(`${index + 1}:`, {
        id: log.id,
        categoryId: log.categoryId,
        category: log.category,
        description: log.description,
        timestamp: log.timestamp,
        cleared: log.cleared,
      });
    });
    console.log('=== END ACTIVITY LOGS ===');
  } catch (error) {
    console.error('Error printing activity logs:', error);
  }
}

export async function debugPrintAllDiscussions(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    return;
  }
  try {
    const discussions = realm.objects('Discussion');
    console.log(`=== DISCUSSIONS (${discussions.length} records) ===`);
    Array.from(discussions).forEach((discussion: any, index: number) => {
      console.log(`${index + 1}:`, {
        id: discussion.id,
        discussionId: discussion.discussionId,
        description: discussion.description,
        timestamp: discussion.timestamp,
        typeSay: discussion.typeSay,
        cleared: discussion.cleared,
      });
    });
    console.log('=== END DISCUSSIONS ===');
  } catch (error) {
    console.error('Error printing discussions:', error);
  }
}

export async function removeDuplicateActivityLogs(): Promise<{
  duplicatesFound: number;
  duplicatesRemoved: number;
}> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }

  let duplicatesFound = 0;
  let duplicatesRemoved = 0;

  try {
    const allLogs = realm.objects<ActivityLog>('ActivityLog');
    const seenCombinations = new Map<string, string>(); // key -> first log ID
    const duplicateIds = new Set<string>();

    // Group logs by discussionId + category + description
    Array.from(allLogs).forEach((log: any) => {
      const key = `${log.discussionId}_${log.category}_${log.description}`;

      if (seenCombinations.has(key)) {
        // This is a duplicate
        duplicatesFound++;
        duplicateIds.add(log.id);
        console.log(
          `Found duplicate ActivityLog: ${
            log.id
          } (original: ${seenCombinations.get(key)})`
        );
      } else {
        // First occurrence
        seenCombinations.set(key, log.id);
      }
    });

    // Remove duplicates
    if (duplicateIds.size > 0) {
      realm.write(() => {
        duplicateIds.forEach((duplicateId) => {
          const log = realm?.objectForPrimaryKey('ActivityLog', duplicateId);
          if (log) {
            realm?.delete(log);
            duplicatesRemoved++;
            console.log(`Removed duplicate ActivityLog: ${duplicateId}`);
          }
        });
      });
    }

    console.log(
      `Duplicate removal complete. Found: ${duplicatesFound}, Removed: ${duplicatesRemoved}`
    );
    return { duplicatesFound, duplicatesRemoved };
  } catch (error) {
    console.error('Error removing duplicate activity logs:', error);
    throw error;
  }
}

export async function checkCategoryReferences(categoryId: string): Promise<{
  hasReferences: boolean;
  referenceCount: number;
  references: { tableName: string; count: number }[];
}> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }

  try {
    // Check ActivityLog references
    const activityLogRefs = realm
      .objects('ActivityLog')
      .filtered('categoryId == $0', categoryId);
    const activityLogCount = activityLogRefs.length;

    const references = [];
    if (activityLogCount > 0) {
      references.push({ tableName: 'ActivityLog', count: activityLogCount });
    }

    const totalCount = activityLogCount;

    return {
      hasReferences: totalCount > 0,
      referenceCount: totalCount,
      references,
    };
  } catch (error) {
    console.error('Error checking category references:', error);
    throw error;
  }
}

export async function findCategoryByName(
  name: string
): Promise<Category | null> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }

  try {
    const categories = realm
      .objects<Category>('Category')
      .filtered('name == $0', name);
    if (categories.length > 0) {
      const cat = categories[0];
      return {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        synced: cat.synced,
        syncTimestamp: cat.syncTimestamp,
        uid: cat.uid,
      };
    }
    return null;
  } catch (error) {
    console.error('Error finding category by name:', error);
    return null;
  }
}

export async function mergeCategoryReferences(
  fromCategoryId: string,
  toCategoryId: string
): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }

  try {
    realm.write(() => {
      // Update all ActivityLog references from old category to new category
      const activityLogs = realm
        ?.objects('ActivityLog')
        .filtered('categoryId == $0', fromCategoryId);
      if (activityLogs) {
        for (const log of activityLogs) {
          (log as any).categoryId = toCategoryId;
          (log as any).synced = false;
        }
      }
    });

    console.log(`Merged ${fromCategoryId} references to ${toCategoryId}`);
  } catch (error) {
    console.error('Error merging category references:', error);
    throw error;
  }
}

export async function deleteCategoryLocal(id: string): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const category = realm?.objectForPrimaryKey('Category', id);
      if (category) {
        realm?.delete(category);
      }
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}
