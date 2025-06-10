// Changelog-aware legacy import for Discussions and ActivityLogs
import {
  importLegacyDiscussions,
  importLegacyActivityLogs,
  ensureStringIds,
} from './dbServicesLocal';
import { addChangeLogEntry } from './dbServicesLocal';
import { createAndSyncChangelogEntry } from './dbServicesRemote';
import fs from 'fs';
import path from 'path';

/**
 * Import legacy Firebase data from a JSON file into Realm, and create changelog entries for each row (local + remote).
 * @param filePath Path to the legacy Firebase export JSON file
 * @returns Promise<{discussions: number, activityLogs: number, changelogEntries: number}>
 */
export async function importLegacyFirebaseDataWithChangelog(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  let discussions = 0;
  let activityLogs = 0;
  let changelogEntries = 0;

  // Helper to get timestamp for changelog
  function getRowTimestamp(row: any): Date {
    if (row.syncTimestamp) return new Date(row.syncTimestamp);
    if (row.timestamp) return new Date(row.timestamp);
    return new Date();
  }

  // Import Discussions
  if (data.discussions && Array.isArray(data.discussions)) {
    await importLegacyDiscussions(data.discussions);
    discussions = data.discussions.length;
    for (const d of data.discussions) {
      const discussion = ensureStringIds(d);
      const ts = getRowTimestamp(discussion);
      addChangeLogEntry('Discussion', discussion.id, 'create', ts);
      await createAndSyncChangelogEntry(
        'Discussion',
        discussion.id,
        'create',
        ts
      );
      changelogEntries++;
    }
  }

  // Import ActivityLogs
  if (data.activityLogs && Array.isArray(data.activityLogs)) {
    await importLegacyActivityLogs(data.activityLogs);
    activityLogs = data.activityLogs.length;
    for (const a of data.activityLogs) {
      const activityLog = ensureStringIds(a);
      const ts = getRowTimestamp(activityLog);
      addChangeLogEntry('ActivityLog', activityLog.id, 'create', ts);
      await createAndSyncChangelogEntry(
        'ActivityLog',
        activityLog.id,
        'create',
        ts
      );
      changelogEntries++;
    }
  }

  return { discussions, activityLogs, changelogEntries };
}
