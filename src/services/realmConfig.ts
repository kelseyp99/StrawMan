import Realm, { Configuration } from 'realm';

console.log('Loading realmConfig.ts...');

const ActivityLogSchema = {
  name: 'ActivityLog',
  properties: {
    id: 'int',
    discussionId: 'int',
    category: 'string',
    description: 'string',
    timestamp: 'date',
    cleared: 'bool',
    synced: 'bool',
    syncTimestamp: 'date?',
  },
  primaryKey: 'id',
};

const DiscussionSchema = {
  name: 'Discussion',
  properties: {
    id: 'int',
    timestamp: 'date',
    type: 'string',
    description: 'string',
    cleared: 'bool',
    activityLogs: 'ActivityLog[]',
    synced: 'bool',
    syncTimestamp: 'date?',
  },
  primaryKey: 'id',
};

const ParametersSchema = {
  name: 'parameters',
  properties: {
    paramName: 'string',
    paramValue: 'string?',
  },
  primaryKey: 'paramName',
};

const LogsSchema = {
  name: 'Logs',
  properties: {
    id: 'int',
    timestamp: 'date',
    level: 'string',
    message: 'string',
    error: 'string?',
  },
  primaryKey: 'id',
};

const GPTResponsesSchema = {
  name: 'GPTResponses',
  properties: {
    id: 'int',
    discussionId: 'int',
    timestamp: 'date',
    prompt: 'string',
    response: 'string',
    responseType: 'string',
    cleared: 'bool',
    synced: 'bool',
    syncTimestamp: 'date?',
  },
  primaryKey: 'id',
};

const AlertSchema = {
  name: 'Alert',
  primaryKey: '_id',
  properties: {
    _id: 'objectId',
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

const GPTSpecialtiesSchema = {
  name: 'GPTSpecialties',
  properties: {
    id: 'int',
    name: 'string',
    url: 'string',
    apiKey: 'string',
  },
  primaryKey: 'id',
};

const DiscussionCountSchema = {
  name: 'DiscussionCount',
  properties: {
    id: 'int',
    discussionId: 'int',
    count: 'int',
    description: 'string',
    timestamp: 'date',
  },
  primaryKey: 'id',
};

const config: Configuration = {
  path: '/data/data/com.lifelog/databases/ActivityLog.realm',
  schema: [
    ActivityLogSchema,
    DiscussionSchema,
    ParametersSchema,
    LogsSchema,
    GPTResponsesSchema,
    GPTSpecialtiesSchema,
    AlertSchema,
    DiscussionCountSchema,
  ],
  schemaVersion: 8, // bump version for schema change
};

const ChangeLogSchema = {
  name: 'ChangeLog',
  primaryKey: 'id',
  properties: {
    id: 'string', // Unique ID for the changelog entry
    tableName: 'string', // e.g., 'ActivityLog', 'Discussion'
    rowId: 'string', // ID of the affected row
    operation: 'string', // 'create', 'update', 'delete'
    timestamp: 'date', // When the change occurred
  },
};

const realm = new Realm(config);

export {
  realm,
  ActivityLogSchema,
  DiscussionSchema,
  ParametersSchema,
  LogsSchema,
  GPTResponsesSchema,
  GPTSpecialtiesSchema,
  ChangeLogSchema,
  AlertSchema,
  DiscussionCountSchema,
};
