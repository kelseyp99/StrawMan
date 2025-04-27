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
  ],
  schemaVersion: 7,
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
  AlertSchema,
};
