// src/services/realmConfig.ts
import Realm, { Configuration } from 'realm';

console.log('Loading realmConfig.ts...');

const UserSchema = {
  name: 'User',
  primaryKey: 'id',
  properties: {
    id: 'string',
    appVersion: 'string',
    appId: 'string',
    timestamp: 'date',
    isPaid: 'bool',
    subscriptionStartDate: 'date?', // Added for yearly subscription
    subscriptionExpiryDate: 'date?', // Added for yearly subscription
  },
};

const ActivityLogSchema = {
  name: 'ActivityLog',
  primaryKey: 'id',
  properties: {
    id: 'string',
    discussionId: 'string',
    categoryId: 'string',
    category: 'string',
    description: 'string',
    timestamp: 'date',
    cleared: 'bool',
    responseType: 'string?',
    synced: 'bool',
    syncTimestamp: 'date?',
    uid: 'string?',
    lockedCategory: 'bool?',
    lockedDescription: 'bool?',
    attachedFile: 'string?',
  },
};

const DiscussionSchema = {
  name: 'Discussion',
  primaryKey: 'id',
  properties: {
    id: 'string',
    discussionId: 'string',
    description: 'string',
    timestamp: 'date',
    typeSay: 'string',
    cleared: 'bool',
    activityLogs: 'ActivityLog[]', // Added from second config
    synced: 'bool',
    syncTimestamp: 'date?',
    uid: 'string?',
  },
};

const ParametersSchema = {
  name: 'Parameters',
  primaryKey: 'parameterName',
  properties: {
    parameterName: 'string',
    parameterValue: 'string?',
  },
};

const LogsSchema = {
  name: 'Logs',
  primaryKey: 'id',
  properties: {
    id: 'string',
    timestamp: 'date',
    level: 'string',
    message: 'string',
    error: 'string?',
  },
};

const GPTResponsesSchema = {
  name: 'GPTResponses',
  primaryKey: 'id',
  properties: {
    id: 'string',
    discussionId: 'string',
    timestamp: 'date',
    prompt: 'string',
    response: 'string',
    responseType: 'string',
    cleared: 'bool',
    synced: 'bool',
    syncTimestamp: 'date?',
  },
};

const GPTSpecialtiesSchema = {
  name: 'GPTSpecialties',
  primaryKey: 'id',
  properties: {
    id: 'string',
    name: 'string',
    url: 'string',
    apiKey: 'string',
  },
};

const AlertSchema = {
  name: 'Alert',
  primaryKey: 'id',
  properties: {
    id: 'string', // Kept from first config for consistency
    description: 'string',
    frequency: 'string',
    date: 'date?',
    timeOfDay: 'string?',
    nextTrigger: 'date',
    isActive: 'bool',
    createdAt: 'date',
    updatedAt: 'date?',
  },
};

const DocumentSchema = {
  name: 'Document',
  primaryKey: 'id',
  properties: {
    id: 'string',
    timestamp: 'date',
  },
};

const RuleSchema = {
  name: 'Rule',
  primaryKey: 'id',
  properties: {
    id: 'string',
    pattern: 'string',
    isRegex: 'bool',
    category: 'string',
    priority: 'int',
  },
};

const SyncEntrySchema = {
  name: 'SyncEntry',
  primaryKey: 'id',
  properties: {
    id: 'string',
    tableName: 'string',
    operation: 'string',
    timestamp: 'date',
  },
};

const DiscussionCountSchema = {
  name: 'DiscussionCount',
  primaryKey: 'id',
  properties: {
    id: 'string',
    discussionId: 'string',
    count: 'int',
    description: 'string',
    timestamp: 'date',
  },
};

const ChangeLogSchema = {
  name: 'ChangeLog',
  primaryKey: 'id',
  properties: {
    id: 'string',
    tableName: 'string',
    rowId: 'string',
    operation: 'string',
    timestamp: 'date',
  },
};

const CategorySchema = {
  name: 'Category',
  primaryKey: 'id',
  properties: {
    id: 'string',
    name: 'string',
    description: 'string?',
    createdAt: 'date',
    updatedAt: 'date',
    synced: 'bool',
    syncTimestamp: 'date?',
    uid: 'string',
  },
};

const config: Configuration = {
  path: 'lifelog.realm', // Kept from first config
  schema: [
    UserSchema,
    ActivityLogSchema,
    DiscussionSchema,
    ParametersSchema,
    LogsSchema,
    GPTResponsesSchema,
    GPTSpecialtiesSchema,
    AlertSchema,
    DocumentSchema,
    RuleSchema,
    SyncEntrySchema,
    DiscussionCountSchema,
    ChangeLogSchema,
    CategorySchema,  ],
  schemaVersion: 14, // Bumped from 13 to 14 to add uid, lockedCategory, lockedDescription, attachedFile fields
  onMigration: (oldRealm: Realm, newRealm: Realm) => {
    console.log(
      'Migrating Realm schema from version',
      oldRealm.schemaVersion,
      'to',
      newRealm.schemaVersion
    );
    if (oldRealm.schemaVersion < 7) {
      // Existing migration logic
      newRealm.objects('ActivityLog').forEach((log) => {
        if (!log.synced) log.synced = false;
        if (!log.syncTimestamp) log.syncTimestamp = null;
      });
      newRealm.objects('Discussion').forEach((discussion) => {
        if (!discussion.synced) discussion.synced = false;
        if (!discussion.syncTimestamp) discussion.syncTimestamp = null;
      });
      newRealm.objects('GPTResponses').forEach((response) => {
        if (!response.synced) response.synced = false;
        if (!response.syncTimestamp) response.syncTimestamp = null;
      });
    }
    if (oldRealm.schemaVersion < 9) {
      console.log(
        '[Migration] Adding ChangeLogSchema and DiscussionCountSchema, removing uid fields'
      );
      // No data migration needed for new schemas or uid removal
    }
    if (oldRealm.schemaVersion < 14) {
      console.log('[Migration] Adding uid, lockedCategory, lockedDescription, attachedFile fields');
      // Set default values for new fields
      newRealm.objects('ActivityLog').forEach((log: any) => {
        if (log.uid === undefined) log.uid = 'local-user';
        if (log.lockedCategory === undefined) log.lockedCategory = false;
        if (log.lockedDescription === undefined) log.lockedDescription = false;
        if (log.attachedFile === undefined) log.attachedFile = null;
      });
      newRealm.objects('Discussion').forEach((discussion: any) => {
        if (discussion.uid === undefined) discussion.uid = 'local-user';
      });
    }
  },
};

let realmInstance: Realm | null = null;
try {
  realmInstance = new Realm(config);
  console.log('Realm initialized at:', realmInstance.path);
} catch (error) {
  console.error('Failed to initialize Realm:', error);
}

export const realm = realmInstance;
export {
  UserSchema,
  ActivityLogSchema,
  DiscussionSchema,
  ParametersSchema,
  LogsSchema,
  GPTResponsesSchema,
  GPTSpecialtiesSchema,
  AlertSchema,
  DocumentSchema,
  RuleSchema,
  SyncEntrySchema,
  DiscussionCountSchema,
  ChangeLogSchema,
  CategorySchema,
};
