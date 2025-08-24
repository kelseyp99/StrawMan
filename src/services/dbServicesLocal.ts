import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Share from 'react-native-share';
// Initialize default categories if none exist
// Export all Realm data to a JSON file in the Downloads directory
export async function exportRealmDataToFile(filename: string = 'lifelog_backup.json', shareAfterExport: boolean = false): Promise<string> {
  if (!realm) {
  throw new Error('Realm not initialized');
  }
  try {
  // Gather all data from main tables
  const schemaNames = [
  'Discussion',
  'ActivityLog',
  'Category',
  'GPTResponse',
  'Alert',
  'User',
  ];
  const data: Record<string, unknown> = {};
  for (const tableName of schemaNames) {
  try {
          const objects = realm.objects(tableName);
          data[tableName] = Array.from(objects).map((obj: Record<string, unknown>) => ({ ...obj }));
  } catch (error) {
          // Table may not exist, skip
  }
  }
  // Serialize to JSON
  const json = JSON.stringify(data, null, 2);
  // Get Downloads directory path
  const downloadsDir = RNFS.DownloadDirectoryPath || RNFS.ExternalStorageDirectoryPath;
  const filePath = `${downloadsDir}/${filename}`;
  // Write file
  await RNFS.writeFile(filePath, json, 'utf8');
  console.log(`Exported Realm data to file: ${filePath}`);
  if (shareAfterExport) {
    try {
      await Share.open({
        url: 'file://' + filePath,
        type: 'application/json',
        showAppsToView: true,
        failOnCancel: false,
      });
    } catch (shareError) {
      console.error('Error sharing exported file:', shareError);
    }
  }
  return filePath;
  } catch (error) {
  console.error('Error exporting Realm data to file:', error);
  throw error;
  }
}
// Initialize default categories if none exist
export async function initializeDefaultCategories() {
  if (!realm) return;
  const existing = realm.objects('Category');
  if (existing.length > 0) return;
  const defaults = [
    { name: 'Diet', description: 'Food and nutrition' },
    { name: 'Exercise', description: 'Physical activity' },
    { name: 'Mood', description: 'Emotional state' },
  ];
  const uid = await getUID();
  realm!.write(() => {
    defaults.forEach((cat) => {
      realm!.create('Category', {
        id: `${cat.name.toLowerCase()}_${Date.now()}`,
        name: cat.name,
        description: cat.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        synced: false,
        syncTimestamp: null,
        uid: uid || 'local',
      });
    });
  });
  try {
    await AsyncStorage.setItem('categoriesSeeded', 'true');
  } catch {}
}
import Realm, { UpdateMode } from 'realm';
import { realm } from '../realmConfig';
import { getUID } from '../utils/uidManager';
import { ENABLE_DISCUSSION_SYNC, ENABLE_ACTIVITYLOG_SYNC } from './syncConfig';
import { ActivityLog, Discussion } from './types';
import { processPhrase } from './phraseProcessor';
import * as remote from './dbServicesRemote';

const APP_VERSION = '1.1.0';
const APP_ID = 'com.anonymous.lifelog';

// Interfaces matching realmConfig.ts schemas
interface User {
  id: string;
  appVersion: string;
  appId: string;
  timestamp: Date;
  isPaid: boolean;
  subscriptionStartDate?: Date;
  subscriptionExpiryDate?: Date;
}

export interface Parameters {
  parameterName: string;
  parameterValue?: string;
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
        uid: (log as unknown as { uid?: string }).uid || 'local_user',
        lockedCategory: (log as unknown as { lockedCategory?: boolean }).lockedCategory || false,
        lockedDescription: (log as unknown as { lockedDescription?: boolean }).lockedDescription || false,
        categoryId: (log as unknown as { categoryId?: string }).categoryId,
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
            uid: (log as unknown as { uid?: string }).uid || 'local_user',
            lockedCategory: (log as unknown as { lockedCategory?: boolean }).lockedCategory || false,
            lockedDescription: (log as unknown as { lockedDescription?: boolean }).lockedDescription || false,
            categoryId: (log as unknown as { categoryId?: string }).categoryId,
          } as ActivityLog;
        }
      }
    }

    return null;
  } catch (error) {
  // Error finding duplicate ActivityLog
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
      realm?.create(
        'SyncEntry',
        {
          id: entry.id,
          tableName: entry.tableName,
          operation: entry.operation,
          timestamp: entry.timestamp,
        },
        UpdateMode.Modified
      ); // Use UpdateMode.Modified to update existing entries
    });
    // SyncEntry logged
  } catch (error) {
    // Error logging SyncEntry to Realm
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
        subscriptionStartDate: undefined,
        subscriptionExpiryDate: undefined,
      };
      const existingUser = realm?.objects<User>('User')[0];
      if (existingUser) {
  // User already initialized
        // Only update non-primary key fields
        existingUser.appVersion = userData.appVersion;
        existingUser.appId = userData.appId;
        existingUser.timestamp = userData.timestamp;
        existingUser.isPaid = userData.isPaid;
        existingUser.subscriptionStartDate = userData.subscriptionStartDate;
        existingUser.subscriptionExpiryDate = userData.subscriptionExpiryDate;
      } else {
  // Initializing user
        realm?.create('User', userData);
      }
    });
    // User initialized successfully
  } catch (error) {
    // Error initializing user
    throw error;
  }
}

export async function createDocument(data: Record<string, unknown>): Promise<string> {
  if (!realm) throw new Error('Realm not initialized');
  try {
    const id = Date.now().toString();
    realm?.write(() => {
      realm?.create('Document', {
        id,
        ...data,
        timestamp: data.timestamp ? new Date(data.timestamp as string | number | Date) : new Date(), // Use provided timestamp if available
        synced: false,
      });
    });
    return id;
  } catch (error) {
  // Error creating document
    throw error;
  }
}

export async function readDocuments(): Promise<Record<string, unknown>[]> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    const documents =
      realm?.objects('Document')?.map((doc) => ({ id: doc.id, ...doc })) ?? [];
    return documents;
  } catch (error) {
  // Error reading documents
    throw error;
  }
}

export async function updateDocument(docId: string, data: Record<string, unknown>): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm?.write(() => {
      const doc = realm?.objectForPrimaryKey('Document', docId);
      if (doc) {
        Object.assign(doc, { ...data, synced: false });
      }
    });
  } catch (error) {
  // Error updating document
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
  // Document deleted
      }
    });
  } catch (error) {
  // Error deleting document
    throw error;
  }
}

export async function getDistinctCategories(): Promise<string[]> {
  if (!realm) {
  // Error: Failed to open Realm instance
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
    return categories;
  } catch (error) {
  // Error getting distinct categories
    return [];
  }
}

export async function insertJsonFile(jsonData: Array<{ category: string; value: string }>): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm?.write(() => {
      jsonData.forEach((item) => {
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // Fetch from cloud API
  const backendService = (require('./syncService')).default;
    const remoteLogs = await backendService.getAllActivityLogs();
    realm.write(() => {
      remoteLogs.forEach((log: unknown) => {
        const l: any = log;
  realm!.create('ActivityLog', {
          id: l.id,
          discussionId: l.discussionId || '',
          categoryId: l.categoryId || '',
          category: l.category || '',
          description: l.description || '',
          timestamp: l.timestamp ? new Date(l.timestamp) : new Date(),
          cleared: l.cleared ?? false,
          responseType: l.responseType ?? '',
          synced: true,
          syncTimestamp: new Date(),
          uid: l.uid || 'local_user',
          lockedCategory: l.lockedCategory ?? false,
          lockedDescription: l.lockedDescription ?? false,
          attachedFile: l.attachedFile ?? '',
        }, UpdateMode.Modified);
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

export async function synchronizeCategories(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  appVersion: string
): Promise<void> {
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
    let categories = realm.objects<Category>('Category');
    let categoryArray = Array.from(categories).map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      synced: cat.synced,
      syncTimestamp: cat.syncTimestamp,
      uid: cat.uid,
    }));

    // If all categories were deleted, repopulate defaults and re-read
    if (categoryArray.length === 0) {
      try {
        await initializeDefaultCategories();
        categories = realm.objects<Category>('Category');
        categoryArray = Array.from(categories).map((cat) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
          synced: cat.synced,
          syncTimestamp: cat.syncTimestamp,
          uid: cat.uid,
        }));
      } catch (seedErr) {
        console.warn('[CATEGORIES] Repopulate defaults failed/skipped:', seedErr);
      }
    }

    // Filter out duplicates by name, keeping the most recent one
    const uniqueCategories = new Map<string, Category>();
    categoryArray.forEach(category => {
      const existing = uniqueCategories.get(category.name);
      if (!existing || (category.updatedAt && existing.updatedAt && category.updatedAt > existing.updatedAt)) {
        uniqueCategories.set(category.name, category);
      }
    });

    return Array.from(uniqueCategories.values());
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
    let categories = realm.objects<Category>('Category');
    let categoryNames = Array.from(categories)
      .map((cat) => cat.name)
      .filter(
        (name) =>
          typeof name === 'string' &&
          name.trim().length > 1 &&
          name.trim().toLowerCase() !== 'the' &&
          name.trim().toLowerCase() !== 'null' &&
          name.trim().toLowerCase() !== 'undefined'
      );
    if (categoryNames.length === 0) {
      try {
        await initializeDefaultCategories();
        categories = realm.objects<Category>('Category');
        categoryNames = Array.from(categories)
          .map((cat) => cat.name)
          .filter(
            (name) =>
              typeof name === 'string' &&
              name.trim().length > 1 &&
              name.trim().toLowerCase() !== 'the' &&
              name.trim().toLowerCase() !== 'null' &&
              name.trim().toLowerCase() !== 'undefined'
          );
      } catch (seedErr) {
        console.warn('[CATEGORIES] Repopulate names failed/skipped:', seedErr);
      }
    }
    // Remove duplicates using Set
    return Array.from(new Set(categoryNames));
  } catch (error) {
    console.error('Error getting category names:', error);
    throw error;
  }
}

export async function cleanupDuplicateCategories(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  
  try {
    const categories = realm.objects<Category>('Category');
    const categoryMap = new Map<string, Category[]>();
    
    // Group categories by name
    Array.from(categories).forEach(category => {
      const name = category.name;
      if (!categoryMap.has(name)) {
        categoryMap.set(name, []);
      }
      categoryMap.get(name)!.push(category);
    });
    
    realm.write(() => {
      categoryMap.forEach((categoriesWithSameName, name) => {
        if (categoriesWithSameName.length > 1) {
          // Sort by updatedAt to keep the most recent
          categoriesWithSameName.sort((a, b) => {
            const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(0);
            const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
          
          // Keep the first (most recent) and delete the rest
          const toKeep = categoriesWithSameName[0];
          const toDelete = categoriesWithSameName.slice(1);
          
          console.log(`[CLEANUP] Keeping category "${name}" with ID ${toKeep.id}, deleting ${toDelete.length} duplicates`);
          
          toDelete.forEach(duplicate => {
            realm?.delete(duplicate);
          });
        }
      });
    });
    
    console.log('[CLEANUP] Duplicate category cleanup completed');
  } catch (error) {
    console.error('Error cleaning up duplicate categories:', error);
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
    const currentUID = (await getUID()) || 'local_user';

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
      categoryId: (log as unknown as { categoryId?: string }).categoryId,
      uid: (log as unknown as { uid?: string }).uid || 'local_user',
      lockedCategory: (log as unknown as { lockedCategory?: boolean }).lockedCategory || false,
      lockedDescription: (log as unknown as { lockedDescription?: boolean }).lockedDescription || false,
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
          synced: false,
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
      const logData = {
        id,
        ...activityLog,
        synced: false,
        categoryId: typeof activityLog.categoryId === 'string' ? activityLog.categoryId : '',
      };
      realm?.create('ActivityLog', logData);
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
    console.log('[DEBUG] Attempting to delete ActivityLog with id:', activityLogId);
    realm.write(() => {
      const log = realm?.objectForPrimaryKey('ActivityLog', activityLogId);
      if (log) {
        realm?.delete(log);
        console.log('[DEBUG] Deleted ActivityLog:', activityLogId);
      } else {
        console.warn('[DEBUG] No ActivityLog found with id:', activityLogId);
      }
    });
  // ...existing code...

// ...existing code...
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
        (log as unknown as { category?: string }).category = category;
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
        (discussion as unknown as { cleared?: boolean }).cleared = true;
      }
    });
  } catch (error) {
    console.error('Error marking discussion as cleared:', error);
    throw error;
  }
}

// Add placeholder functions for missing ones
export async function getNextOpenDiscussion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lastVisibleId?: string
): Promise<{ snapshot: unknown[]; hasMore: boolean; lastVisibleDoc: unknown | null }> {
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
    const pendingTells = discussions.filtered(
      'typeSay == "tell" AND cleared == false'
    );

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
      const existingActivityLog = realm
        .objects<ActivityLog>('ActivityLog')
        .filtered('discussionId == $0', discussion.id);

      if (existingActivityLog.length > 0) {
        console.log(
          'ActivityLog already exists for discussion:',
          discussion.id
        );
        // Mark discussion as cleared
        realm.write(() => {
          discussion.cleared = true;
        });
        continue;
      }

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

        console.log(
          `Created ActivityLog for discussion ${discussion.id} with category: ${result.category}`
        );

        // Mark discussion as cleared
        realm.write(() => {
          discussion.cleared = true;
        });
      } catch (error) {
        console.error(
          'Error processing tell statement:',
          discussion.description,
          error
        );
      }
    }

    console.log('Finished processing pending tell statements');
  } catch (error) {
    console.error('Error in processPendingTells:', error);
  }
}

export async function addQuestionDiscussion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  question: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export async function getLastOpenDiscussion(): Promise<{
  id: string;
  description: string;
}> {
  return { id: '', description: '' };
}

export async function disperseQuestion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  discussionId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gptResponseId: string
): Promise<string[] | undefined> {
  return undefined;
}

export async function addOrUpdateGPTResponse(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  discussionId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  response: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  responseType: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cleared: boolean = false
): Promise<void> {
  // Placeholder
}

export async function getGPTResponses(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  discussionId: string
): Promise<Record<string, unknown>[]> {
  return [];
}

export async function getParsedGPTResponses(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  discussionId: string
): Promise<string[]> {
  return [];
}

export async function getAIResponse(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  question: string
): Promise<string> {
  return '';
}

export async function syncToCloud(
  tableName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  payload?: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  method?: string
): Promise<void> {
  console.log(`Local syncToCloud called for table: ${tableName}`);

  if (!realm) {
    console.error('Realm not initialized for sync');
    return;
  }

  try {
    // Get unsynced records for the specified table
    const unsyncedRecords = realm
      .objects(tableName)
      .filtered('synced == false');
    console.log(
      `Found ${unsyncedRecords.length} unsynced ${tableName} records`
    );

    if (unsyncedRecords.length === 0) {
      console.log(`No unsynced ${tableName} records to sync`);
      return;
    }

    // Convert Realm objects to plain objects for syncing
    const recordsToSync = Array.from(unsyncedRecords).map((record: Record<string, unknown>) => ({
      ...record,
      // Convert dates to ISO strings for Firestore
      createdAt:
        record.createdAt instanceof Date
          ? record.createdAt
          : new Date((record.createdAt as string | number) || Date.now()),
      updatedAt:
        record.updatedAt instanceof Date
          ? record.updatedAt
          : new Date((record.updatedAt as string | number) || Date.now()),
    }));

    // Sync records to Firestore
    const syncedIds = await remote.syncRealmRowsToFirestore(
      tableName,
      recordsToSync
    );
    console.log(
      `Successfully synced ${syncedIds.length} ${tableName} records to Firestore`
    );

    // Mark synced records as synced in Realm
    if (realm) {
      realm.write(() => {
        for (const syncedId of syncedIds) {
          const record = realm!.objectForPrimaryKey(tableName, syncedId);
          if (record) {
            (record as Record<string, unknown>).synced = true;
          }
        }
      });
    }

    console.log(
      `Marked ${syncedIds.length} ${tableName} records as synced in Realm`
    );
  } catch (error) {
    console.error(`Error syncing ${tableName} to cloud:`, error);
    throw error;
  }
}

export async function getNextActiveAlert(): Promise<Record<string, unknown> | null> {
  return null;
}

export async function addOrUpdateAlert(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  alertData: Record<string, unknown>
): Promise<void> {
  // Placeholder
}

export async function deactivateAlertByKey(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  key: number
): Promise<void> {
  // Placeholder
}

export async function getURLofGPT(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gpt_name: string
): Promise<{ url: string; apiKey: string } | null> {
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

export async function getRules(): Promise<Record<string, unknown>[]> {
  return [];
}

export async function updateGPTSpecialties(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gptSpecialty: Record<string, unknown>
): Promise<void> {
  // Placeholder
}

export async function getParameters(): Promise<Record<string, unknown>[]> {
  return [];
}

export async function getDescriptionsWithTimestamps(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  categories: string[]
): Promise<string> {
  return '[]';
}

export async function createRuleCandidate(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  data: Record<string, unknown>
): Promise<void> {
  // Placeholder
}

/**
 * Read local ChangeLog entries for a table, optionally filtered by synced status.
 */
export async function readChangeLog({
  tableName,
  synced,
}: {
  tableName: string;
  synced?: boolean;
}): Promise<Record<string, unknown>[]> {
  if (!realm) throw new Error('Realm not initialized');
  let query = `tableName == $0`;
  const args: unknown[] = [tableName];
  if (typeof synced === 'boolean') {
    query += ' AND synced == $1';
    args.push(synced);
  }
  const results = realm.objects('ChangeLog').filtered(query, ...args);
  return results.map((entry: Record<string, unknown>) => ({ ...entry }));
}

/**
 * Apply a ChangeLog operation to the local Realm database.
 * Handles 'create', 'update', and 'delete' for the given table and rowId.
 */
export async function applyChangeLogOperation(
  tableName: string,
  entry: Record<string, unknown>
): Promise<void> {
  if (!realm) throw new Error('Realm not initialized');
  realm.write(() => {
    if (entry.operation === 'delete') {
      const obj = realm!.objectForPrimaryKey(tableName, entry.rowId);
      if (obj) realm!.delete(obj);
    } else if (entry.operation === 'create' || entry.operation === 'update') {
      // For simplicity, assume entry.data is a snapshot of the row
      if (entry.data) {
        realm!.create(tableName, entry.data, Realm.UpdateMode.Modified);
      }
    }
  });
}

/**
 * Add or update a ChangeLog entry in local Realm.
 */
export async function addOrUpdateChangeLogEntry(
  tableName: string,
  rowId: string,
  operation: string,
  timestamp: Date,
  data?: Record<string, unknown>
): Promise<void> {
  if (!realm) throw new Error('Realm not initialized');
  realm.write(() => {
    realm!.create(
      'ChangeLog',
      {
        id: `${tableName}_${rowId}_${new Date(timestamp).getTime()}`,
        tableName,
        rowId,
        operation,
        timestamp: new Date(timestamp),
        synced: false,
        data: data || null,
      },
      Realm.UpdateMode.Modified
    );
  });
}

/**
 * Mark a ChangeLog entry as synced in local Realm.
 */
export async function markChangeLogEntrySynced(
  tableName: string,
  rowId: string
): Promise<void> {
  if (!realm) throw new Error('Realm not initialized');
  realm.write(() => {
    const entries = realm!
      .objects('ChangeLog')
      .filtered('tableName == $0 AND rowId == $1', tableName, rowId);
    for (const entry of entries) {
      entry.synced = true;
    }
  });
}

export async function importLegacyDiscussions(
  discussions: Discussion[]
): Promise<number> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  let count = 0;
  try {
    realm.write(() => {
      discussions.forEach((discussion: Discussion) => {
        realm?.create('Discussion', {
          id: discussion.id || Date.now().toString(),
          discussionId: discussion.discussionId || discussion.id,
          description: discussion.description || '',
          timestamp: discussion.timestamp || new Date(),
          typeSay: discussion.typeSay || 'tell',
          cleared: discussion.cleared || false,
          uid: discussion.uid || 'legacy_user',
          synced: false,
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
  activityLogs: ActivityLog[]
): Promise<number> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  let count = 0;
  try {
    realm.write(() => {
      activityLogs.forEach((log: ActivityLog) => {
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
        objects.forEach((obj: Record<string, unknown>) => {
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
        categories.forEach((c: Record<string, unknown>) => {
          categoryMap.set(c.name, c.id);
        });
      }

      if (activityLogs) {
        activityLogs.forEach((log: Record<string, unknown>) => {
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
        activityLogs.forEach((log: Record<string, unknown>) => {
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
          (category as Record<string, unknown>).updatedAt = new Date();
          (category as Record<string, unknown>).synced = false;
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
        Array.from(objects).forEach((obj: Record<string, unknown>, index: number) => {
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
    Array.from(logs).forEach((log: Record<string, unknown>, index: number) => {
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
    Array.from(discussions).forEach((discussion: Record<string, unknown>, index: number) => {
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

// ---------------- CandidateResult Local Persistence ----------------
interface CandidateResultRow {
  id: string; // fixed id (e.g., 'current')
  selectedId?: string | null;
  timestamp: Date;
  uid?: string | null;
  synced: boolean;
  syncTimestamp?: Date | null;
}

export async function saveCandidateResult(selectedId: string | null, uid?: string | null): Promise<string> {
  if (!realm) throw new Error('Realm not initialized');
  const id = 'current';
  try {
    realm.write(() => {
      realm!.create<CandidateResultRow>('CandidateResult', {
        id,
        selectedId: selectedId || null,
        timestamp: new Date(),
        uid: uid || 'local-user',
        synced: false,
        syncTimestamp: null,
      }, Realm.UpdateMode.Modified);
    });
    return id;
  } catch (e) {
    console.error('Error saving CandidateResult:', e);
    throw e;
  }
}

export async function getCandidateResult(): Promise<CandidateResultRow | null> {
  if (!realm) throw new Error('Realm not initialized');
  try {
    const row = realm.objectForPrimaryKey<CandidateResultRow>('CandidateResult', 'current');
    if (!row) return null;
    return {
      id: row.id,
      selectedId: row.selectedId,
      timestamp: row.timestamp,
      uid: row.uid,
      synced: row.synced,
      syncTimestamp: row.syncTimestamp,
    };
  } catch (e) {
    console.error('Error reading CandidateResult:', e);
    return null;
  }
}

export async function appendCandidateResultHistory(selectedId: string | null, uid?: string | null): Promise<string> {
  if (!realm) throw new Error('Realm not initialized');
  const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  try {
    realm.write(() => {
      realm!.create('CandidateResultHistory', {
        id,
        selectedId: selectedId || null,
        timestamp: new Date(),
        uid: uid || 'local-user',
        synced: false,
        syncTimestamp: null,
      });
    });
    return id;
  } catch (e) {
    console.error('Error appending CandidateResultHistory:', e);
    throw e;
  }
}

export async function getCandidateResultHistory(limit = 50): Promise<{ id: string; selectedId?: string | null; timestamp: Date }[]> {
  if (!realm) throw new Error('Realm not initialized');
  try {
    const rows = realm.objects<any>('CandidateResultHistory').sorted('timestamp', true);
    return Array.from(rows.slice(0, limit)).map(r => ({ id: r.id, selectedId: r.selectedId, timestamp: r.timestamp }));
  } catch (e) {
    console.error('Error reading CandidateResultHistory:', e);
    return [];
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
    Array.from(allLogs).forEach((log: ActivityLog) => {
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
          (log as Record<string, unknown>).categoryId = toCategoryId;
          (log as Record<string, unknown>).synced = false;
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

// --- Stubs for missing local sync helpers ---
export async function syncTableFromRemote(
  tableName: string,
  newRows: Record<string, unknown>[]
): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }

  console.log(`[SYNC] syncTableFromRemote: Processing ${newRows.length} rows for ${tableName}`);

  try {
    realm.write(() => {
      for (const row of newRows) {
        if (tableName === 'Category') {
          // Handle Category objects with safe defaults and type coercion
          // Convert Firestore Timestamp objects to JS Date if needed
          function toDateSafe(val: any): Date {
            if (!val) return new Date();
            if (val instanceof Date) return val;
            if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate();
            if (typeof val === 'number') return new Date(Math.trunc(val));
            if (typeof val === 'string') return new Date(val);
            return new Date();
          }
          const safeRow = {
            id: String(row.id || Date.now()),
            name: String(row.name || ''),
            description: String(row.description || ''),
            createdAt: toDateSafe(row.createdAt),
            updatedAt: toDateSafe(row.updatedAt),
            synced: true, // Mark as synced since it came from remote
            uid: row.uid ? String(row.uid) : 'remote_user',
          };
          const existingByName = realm?.objects<Category>('Category').filtered('name = $0', safeRow.name);
          if (!existingByName || existingByName.length === 0) {
            realm?.create('Category', safeRow);
            logChange('Category', safeRow.id, 'insert');
            console.log(`[SYNC] Created new Category: ${safeRow.name} (${safeRow.id})`);
          } else {
            // Update if remote is newer
            const existing = existingByName[0];
            if (row.updatedAt && existing.updatedAt && new Date(row.updatedAt as string | number | Date) > new Date(existing.updatedAt)) {
              existing.description = safeRow.description;
              existing.updatedAt = safeRow.updatedAt;
              existing.synced = true;
              existing.uid = safeRow.uid;
              console.log(`[SYNC] Updated Category: ${safeRow.name}`);
            } else {
              console.log(`[SYNC] Category ${safeRow.name} already exists, skipping`);
            }
          }
        } else if (tableName === 'ActivityLog') {
          // Handle ActivityLog objects
          // Provide defaults for all required fields
          const safeRow = {
            id: row.id || Date.now().toString(),
            discussionId: row.discussionId || '',
            categoryId: row.categoryId || '',
            category: row.category || 'uncategorized',
            description: row.description || '',
            timestamp: row.timestamp ? new Date(row.timestamp as string | number | Date) : new Date(),
            cleared: typeof row.cleared === 'boolean' ? row.cleared : false,
            responseType: row.responseType || '',
            synced: true,
            syncTimestamp: row.syncTimestamp ? new Date(row.syncTimestamp as string | number | Date) : new Date(),
            uid: row.uid || 'remote_user',
            lockedCategory: typeof row.lockedCategory === 'boolean' ? row.lockedCategory : false,
            lockedDescription: typeof row.lockedDescription === 'boolean' ? row.lockedDescription : false,
            attachedFile: row.attachedFile || '',
          };
          let existing: ActivityLog | null = null;
          if (realm) {
            const found = realm.objects<ActivityLog>('ActivityLog').filtered('timestamp = $0', safeRow.timestamp);
            existing = found.length > 0 ? found[0] : null;
          }
          if (!existing) {
            if (realm) {
              realm.create('ActivityLog', safeRow);
              logChange('ActivityLog', String(safeRow.id), 'insert');
              console.log(`[SYNC] Created new ActivityLog: ${safeRow.id}`);
            }
          } else {
            // Update if remote is newer
            if (row.syncTimestamp && existing.syncTimestamp && new Date(row.syncTimestamp as string | number | Date) > new Date(existing.syncTimestamp)) {
              Object.assign(existing, safeRow);
              existing.synced = true;
              console.log(`[SYNC] Updated ActivityLog: ${safeRow.id}`);
            } else {
              console.log(`[SYNC] ActivityLog ${safeRow.id} already exists, skipping`);
            }
          }
        } else if (tableName === 'Discussion') {
          // Handle Discussion objects
          // Coerce all required string fields to string
          const safeRow = {
            id: String(row.id || Date.now()),
            discussionId: String(row.discussionId || row.id || ''),
            description: String(row.description || ''),
            timestamp: row.timestamp ? new Date(row.timestamp as string | number | Date) : new Date(),
            typeSay: String(row.typeSay || 'tell'),
            cleared: typeof row.cleared === 'boolean' ? row.cleared : false,
            synced: true,
            syncTimestamp: row.syncTimestamp ? new Date(row.syncTimestamp as string | number | Date) : new Date(),
            uid: row.uid ? String(row.uid) : 'remote_user',
            activityLogs: [],
          };
          let existingDiscussion: Discussion | null = null;
          if (realm) {
            const found = realm.objects<Discussion>('Discussion').filtered('timestamp = $0', safeRow.timestamp);
            existingDiscussion = found.length > 0 ? found[0] : null;
          }
          if (!existingDiscussion) {
            if (realm) {
              realm.create('Discussion', safeRow);
              logChange('Discussion', String(safeRow.id), 'insert');
              console.log(`[SYNC] Created new Discussion: ${safeRow.id}`);
            }
          } else {
            // Update if remote is newer
            if (row.syncTimestamp && existingDiscussion.syncTimestamp && new Date(row.syncTimestamp as string | number | Date) > new Date(existingDiscussion.syncTimestamp)) {
              Object.assign(existingDiscussion, safeRow);
              existingDiscussion.synced = true;
              console.log(`[SYNC] Updated Discussion: ${safeRow.id}`);
            } else {
              console.log(`[SYNC] Discussion ${safeRow.id} already exists, skipping`);
            }
          }
        } else {
          console.warn(`[SYNC] Unknown table name: ${tableName}`);
        }
      }
    });
    console.log(`[SYNC] Successfully synced ${newRows.length} rows for ${tableName}`);
  } catch (error) {
    console.error(`[SYNC] Error syncing ${tableName} from remote:`, error);
    throw error;
  }
}

export function logChange(
  tableName: string,
  rowId: string,
  operation: string
): void {
  if (!realm) {
    console.error('Failed to open Realm instance');
    return;
  }
  try {
    realm.write(() => {
  realm!.create(
        'ChangeLog',
        {
          id: `${tableName}_${rowId}_${Date.now()}`,
          tableName,
          rowId,
          operation,
          timestamp: new Date(),
          synced: false,
        },
        Realm.UpdateMode.Modified
      );
    });
    console.log(`[ChangeLog] Logged change: ${operation} on ${tableName} row ${rowId}`);
  } catch (error) {
    console.error('Error logging change:', error);
  }
}

export async function deleteAllLocalRows(): Promise<void> {
  if (!realm) {
    console.error('Failed to open Realm instance');
    throw new Error('Failed to open Realm instance');
  }
  try {
    realm.write(() => {
      const tables = ['Discussion', 'ActivityLog', 'ChangeLog', 'Category', 'Document', 'Alert', 'User'];
      for (const table of tables) {
  const objects = realm!.objects(table);
  realm!.delete(objects);
      }
    });
    console.log('All local rows deleted from Realm.');
  } catch (error) {
    console.error('Error deleting all local rows:', error);
    throw error;
  }
}

export async function addChangeLogEntry(
  tableName: string,
  rowId: string,
  operation: string,
  timestamp: Date
): Promise<void> {
  if (!realm) throw new Error('Realm not initialized');
  try {
    realm.write(() => {
  realm!.create(
        'ChangeLog',
        {
          id: `${tableName}_${rowId}_${timestamp.getTime()}`,
          tableName,
          rowId,
          operation,
          timestamp: new Date(timestamp),
          synced: false,
        },
        Realm.UpdateMode.Modified
      );
    });
    console.log(`[ChangeLog] Added entry: ${operation} on ${tableName} row ${rowId} at ${timestamp}`);
  } catch (error) {
    console.error('Error adding change log entry:', error);
    throw error;
  }
}

export async function fetchInitialDiscussion(): Promise<Discussion | null> {
  // Local implementation: return null (no local discussion)
  return null;
}

