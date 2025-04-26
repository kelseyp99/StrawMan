// frontend/src/RealmConfig.ts

import Realm, { Configuration } from 'realm';

console.log('Loading realmConfig.ts...');

//console.log('Realm configuration:');


const ActivityLogSchema = {
  name: 'ActivityLog',
  properties: {
    id: 'int',
    discussionId: 'int', // Add this line
    category: 'string',
    description: 'string',
    timestamp: 'date',
    cleared: 'bool',
  },
  primaryKey: 'id',
};

const DiscussionSchema = {
  name: 'Discussion',
  properties: {
    id: 'int',
    timestamp: 'date',
    type: 'string',// is this a question or an statement of inforamtion to be added
    description: 'string',
    cleared: 'bool',
    activityLogs: 'ActivityLog[]', 
  },
  primaryKey: 'id'
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
    level: 'string', // debug, error, etc.
    message: 'string',
    error: 'string?', // optional error message
  },
  primaryKey: 'id',
};

const GPTResponsesSchema = {
  name: 'GPTResponses',
  properties: {
    id: 'int',
    discussionId : 'int',
    timestamp: 'date',
    prompt: 'string',
    response: 'string', // large response from GPT
    responseType: "string", // is this json instructions to the app or a narrative so the user to read
    cleared: 'bool',
  },
  primaryKey: 'id',
};

const AlertSchema = {
  name: "Alert",
  primaryKey: "_id",
  properties: {
    _id: "objectId",              // Unique identifier for each alert
    description: "string",        // Text to be read aloud
    frequency: "string",          // 'daily', 'weekly', 'monthly', 'yearly', or 'one-time'
    date: "date?",                // Date for one-time alerts
    timeOfDay: "string?",         // Time of day in 'HH:mm' format
    nextTrigger: "date",          // Date and time for the next trigger
    isActive: "bool",             // Whether the alert is currently active
    createdAt: "date",            // When the alert was created
    updatedAt: "date?",           // When the alert was last updated (optional)
  },
};


const GPTSpecialtiesSchema = {
  name: 'GPTSpecialties',
  properties: {
    id: 'int',
    name: 'string', // general, medical, financial, etc.
    url: 'string', // API request URL
    apiKey: 'string', // encrypted API key
  },
  primaryKey: 'id',
};

const config: Configuration = {
  path: '/data/data/com.lifelog/databases/ActivityLog.realm',
  schema: [ActivityLogSchema, DiscussionSchema, ParametersSchema, LogsSchema, GPTResponsesSchema, GPTSpecialtiesSchema, AlertSchema],
  schemaVersion: 6, // Increment when schema changes
};


//console.log(config);

//realm.refresh(); // Add this line to refresh the Realm schema
const realm = new Realm(config);

// Retrieve the schema
const schema = realm.schema;

/* // Loop through each table in the schema
schema.forEach((table) => {
  // Retrieve all objects from the current table
  const objects = realm.objects(table.name);

  // Log the objects to the console
  console.log(`${table.name} objects:`);
  console.log(objects);
}); */
export { realm, ActivityLogSchema, DiscussionSchema, ParametersSchema, LogsSchema, GPTResponsesSchema, GPTSpecialtiesSchema };