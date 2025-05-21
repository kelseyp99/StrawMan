// src/realmConfig.ts
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
    uid: 'string',
    isPaid: 'bool',
  },
};

const ActivityLogSchema = {
  name: 'ActivityLog',
  primaryKey: 'id',
  properties: {
    id: 'int',
    discussionId: 'int',
    category: 'string',
    description: 'string',
    timestamp: 'date',
    cleared: 'bool',
    responseType: 'string?',
    uid: 'string',
    synced: 'bool',
    syncTimestamp: 'date?',
  },
};

const DiscussionSchema = {
  name: 'Discussion',
  primaryKey: 'id',
  properties: {
    id: 'int',
    discussionId: 'int',
    description: 'string',
    timestamp: 'date',
    typeSay: 'string',
    cleared: 'bool',
    synced: 'bool',
    syncTimestamp: 'date?',
    uid: 'string',
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
    id: 'int',
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
    id: 'int',
    discussionId: 'int',
    timestamp: 'date',
    prompt: 'string',
    response: 'string',
    responseType: 'string',
    cleared: 'bool',
    uid: 'string',
    synced: 'bool',
    syncTimestamp: 'date?',
  },
};

const GPTSpecialtiesSchema = {
  name: 'GPTSpecialties',
  primaryKey: 'id',
  properties: {
    id: 'int',
    name: 'string',
    url: 'string',
    apiKey: 'string',
  },
};

const AlertSchema = {
  name: 'Alert',
  primaryKey: 'id',
  properties: {
    id: 'int',
    description: 'string',
    frequency: 'string',
    date: 'date?',
    timeOfDay: 'string?',
    nextTrigger: 'date',
    isActive: 'bool',
    createdAt: 'date',
    updatedAt: 'date?',
    uid: 'string',
  },
};

const DocumentSchema = {
  name: 'Document',
  primaryKey: 'id',
  properties: {
    id: 'int',
    timestamp: 'date',
    uid: 'string',
  },
};

const RuleSchema = {
  name: 'Rule',
  primaryKey: 'id',
  properties: {
    id: 'int',
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
    id: 'int',
    tableName: 'string',
    operation: 'string',
    timestamp: 'date',
    uid: 'string',
  },
};

const config: Configuration = {
  path: 'lifelog.realm', // Relative path in app's data directory
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
  ],
  schemaVersion: 7,
  onMigration: (oldRealm: Realm, newRealm: Realm) => {
    // Handle schema changes from version 2 to 7
    if (oldRealm.schemaVersion < 7) {
      // Add new schemas (Logs, etc.)
      console.log(
        'Migrating Realm schema from version',
        oldRealm.schemaVersion,
        'to 7'
      );
      // Example: Initialize new fields
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
};
