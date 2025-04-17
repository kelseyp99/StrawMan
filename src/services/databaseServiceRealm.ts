declare var confirm: (message: string) => boolean;
import { realm,  GPTResponsesSchema, GPTSpecialtiesSchema  } from "../realmConfig"
import { sendQuestion, sendQuestionForParsing } from './openaiAPI';
//import NetInfo from "@react-native-community/netinfo"; // For checking network connectivity

interface ActivityLog {
  cleared: any;
  id: number;
  discussionId: number;
  category: string;
  description: string;
  timestamp: Date;
}
interface Discussion {
  id: number;
  timestamp: Date;
  description: string;
  cleared: boolean;
}
interface Parameters {
  parameterName: string;
  parameterValue: string;
}

interface DiscussionCloudPayload {
  DiscussionId: string;
  UserId?: string;
  description: string;
  Operation: string;
  typeSay?: string; // Add the typeSay property
}

interface ActivityLogCloudPayload {
  DiscussionId: string;
  UserId?: string;
  description: string;
  Operation: string;
  typeSay?: string; // Add the typeSay property
  cleared: any;
  id: number;
  category: string;
  timestamp: Date;
}

////////////////////////////////////////////////  
// Database functions for Categories table //
////////////////////////////////////////////////

async function getDistinctCategories(): Promise<string[]> {
  console.log('Getting distinct categories...');
  try {
    const categories: string[] = Array.from(
      realm.objects('ActivityLog').snapshot().map((item: any) => item.category as string)
    ) as string[];
    console.log('Categories:', categories);

    return categories;
  } catch (error) {
    console.error('Error getting distinct categories:', error);
    return []; // Return an empty array on error
  }
}

async function insertJsonFile(jsonData: any): Promise<void> {
  try {
    jsonData.forEach((item: any) => {
      const category = item.category;
      const value = item.value;

      switch (category) {
        case 'Food':
          realm.create('ActivityLog', {
            category: 'Food',
            value: `${value} at ${item.time}`,
          });
          break;
        case 'Vitals':
          realm.create('ActivityLog', {
            category: 'Vitals',
            value: `${value}`,
          });
          break;
        // Add more cases for other categories
        default:
          console.log(`Unknown category: ${category}`);
      }
    });

    console.log('Data inserted successfully!');
  } catch (error) {
    console.error('Error inserting data:', error);
  }
}
/* 
async function queryAllFieldsByCategories(categories: string[]): Promise<any[]> {
  console.log('Querying all fields by categories...');
  try {a
    const results = realm.objects('ActivityLog').filtered('category IN $0', categories);
    console.log('Results:', results);
    return Array.from(results);
  } catch (error) {
    console.error('Error querying all fields by categories:', error);
    return Promise.resolve([]); // Return an empty array in case of error
  }
}
 */
////////////////////////////////////////
// Database functions for discussions //
////////////////////////////////////////
export async function addOrUpdateDiscussion(
  description: string,
  typeSay: string = 'tell',
  id?: number
): Promise<any> {
  try {
    if (!realm) {
      console.error('Failed to open Realm instance');
      return;
    }

    if (id === undefined) {
      // Add a new discussion
      await addDiscussion(description, typeSay);
    } else {
      realm.write(() => {
        const discussion = realm.objectForPrimaryKey('Discussion', id);

        if (discussion) {
          if (!description) {
            // Delete the discussion if the description is empty
            realm.delete(discussion);

            // Sync deletion to cloud
            const payload: DiscussionCloudPayload = { DiscussionId: String(id), description: '', Operation: "delete" };
            addOrUpdateDiscussionCloud(payload, 'DELETE');
          } else {
            // Update discussion
            discussion.description = description;

            // Sync update to cloud
            const payload: DiscussionCloudPayload = {  DiscussionId: String(id),  description, Operation: "update", typeSay };
            addOrUpdateDiscussionCloud(payload, 'PUT');
          }
        } else {
          // Add a new discussion if it doesn't exist
          addDiscussion(description, typeSay);
        }
      });
    }
  } catch (error) {
    console.error('Error adding or updating discussion:', error);
  }
}

async function addDiscussion(description: string, typeSay: string = 'tell'): Promise<any> {
  try {
    if (!realm) {
      console.error('Failed to open Realm instance');
      return;
    }

    // Clean up discussions with empty descriptions
    realm.write(() => {
      const discussions = realm.objects('Discussion').filtered('description == null || description == ""');
      realm.delete(discussions);
    });

    const currentTime = new Date();
    const id = currentTime.getTime();

    // Add a new discussion to Realm
    realm.write(() => {
      realm.create('Discussion', {
        id: id,
        timestamp: currentTime,
        description: description,
        cleared: false,
        type: typeSay,
      });
    });

    // Sync to cloud
    const payload: DiscussionCloudPayload = {
      DiscussionId: String(id),
      UserId: "123", // Add the user ID
      description: description,
      Operation: "add",
      typeSay: typeSay,
    };
    await addOrUpdateDiscussionCloud(payload, 'POST');

    return realm.objects('Discussion');
  } catch (error) {
    console.error('Error adding new discussion:', error);
  }
}

const addOrUpdateDiscussionCloud = async (
  payload: DiscussionCloudPayload,
  method: 'POST' | 'PUT' | 'DELETE'
) => {
  console.log("Checking network status...");

  // Simulate network check
  const isOnline = true;

  if (!isOnline) {
    console.log("Device is offline. Sync will be attempted later.");
    updateRealmDiscussionSyncStatus(Number(payload.DiscussionId), false); // Update Realm as not synced
    return;
  }

  console.log("Device is online. Proceeding with cloud sync...");

 // const url = `http://10.0.2.2:5155/api/discussion/${method === 'DELETE' ? payload.id : ''}`; // Append ID for DELETE
//  const url = "http://localhost:5155/api/discussion/${method === 'DELETE' ? payload.id : ''}`; // Append ID for DELETE
const url = "http://localhost:5155/api/discussion/";
  try {
    console.log("Sending request to:", url);
    console.log("Payload:", payload);

    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    let response;
    if (method === 'POST') {
      response = await axios.post(url, payload, config);
    } else if (method === 'PUT') {
      response = await axios.put(url, payload, config);
    } else if (method === 'DELETE') {
      response = await axios.delete(url, config);
    }

    console.log("Activity log synced successfully:", response?.data);

    // Update Realm to mark this discussion as synced
    updateRealmDiscussionSyncStatus(Number(payload.DiscussionId), true);
  } catch (error) {
    console.log("Error syncing discussion to cloud:");
    if (axios.isAxiosError(error)) {
      console.error("Error response:", error.response?.data);
    } else {
      console.error("Unexpected error:", error);
    }

    // Update Realm to indicate sync failed
    updateRealmDiscussionSyncStatus(Number(payload.DiscussionId), false);
  }
};

// Helper function to update the Realm sync status
const updateRealmDiscussionSyncStatus = (id: number, synced: boolean) => {
  try {
    realm.write(() => {
      const discussion = realm.objectForPrimaryKey("Discussion", id);
      if (discussion) {
        discussion.synced = synced; // Update the "synced" field
        discussion.syncTimestamp = new Date(); // Optionally add a timestamp
      } else {
        console.log(`Discussion with ID ${id} not found in Realm.`);
      }
    });
  } catch (error) {
    console.error("Error updating Realm sync status:", error);
  }
};
/////////////////////////////////////////
// Database functions for Generic Tables //
/////////////////////////////////////////

interface CloudPayload {
  timestamp: Date;
  id: string;
  description: string;
  Operation: string;
  typeSay?: string;
  [key: string]: any; // Allow additional properties for flexibility
}

export async function addOrUpdateRecord<T extends CloudPayload>(
  tableName: string,
  payload: T,
  id?: number
): Promise<any> {
  try {
    if (!realm) {
      console.error('Failed to open Realm instance');
      return;
    }

    if (id === undefined) {
      // Add a new record
      await addRecord(tableName, payload);
    } else {
      realm.write(() => {
        const record = realm.objectForPrimaryKey(tableName, id);

        if (record) {
          if (!payload.description) {
            // Delete the record if the description is empty
            realm.delete(record);

            // Sync deletion to cloud
            payload.Operation = 'delete';
            syncToCloud(tableName, payload, 'DELETE');
          } else {
            // Update record
            Object.assign(record, payload);

            // Sync update to cloud
            payload.Operation = 'update';
            syncToCloud(tableName, payload, 'PUT');
          }
        } else {
          // Add a new record if it doesn't exist
          addRecord(tableName, payload);
        }
      });
    }
  } catch (error) {
    console.error(`Error adding or updating ${tableName}:`, error);
  }
}

async function addRecord<T extends CloudPayload>(tableName: string, payload: T): Promise<any> {
  try {
    if (!realm) {
      console.error('Failed to open Realm instance');
      return;
    }

    // Clean up empty records
    realm.write(() => {
      const records = realm.objects(tableName).filtered('description == null || description == ""');
      realm.delete(records);
    });

    const currentTime = new Date();
    const id = currentTime.getTime();
    payload.id = String(id); // Add ID to payload
    payload.timestamp = currentTime; // Add timestamp

    // Add a new record to Realm
    realm.write(() => {
      realm.create(tableName, { ...payload });
    });

    // Sync to cloud
    payload.Operation = 'add';
    await syncToCloud(tableName, payload, 'POST');

    return realm.objects(tableName);
  } catch (error) {
    console.error(`Error adding new ${tableName}:`, error);
  }
}
const syncToCloud = async <T extends CloudPayload>(
  tableName: string,
  payload: T,
  method: 'POST' | 'PUT' | 'DELETE'
) => {
  console.log("Checking network status...");

  const isOnline = true; // Simulated network check
  if (!isOnline) {
    console.log("Device is offline. Sync will be attempted later.");
    updateRealmSyncStatus(tableName, Number(payload.id), false);
    return;
  }

  const url = `http://localhost:5155/api/${tableName.toLowerCase()}`;
  try {
    console.log(`Sending request to: ${url}`);
    console.log("Payload:", payload);

    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    let response;
    if (method === 'POST') {
      response = await axios.post(url, payload, config);
    } else if (method === 'PUT') {
      response = await axios.put(url, payload, config);
    } else if (method === 'DELETE') {
      response = await axios.delete(`${url}/${payload.id}`, config);
    }

    console.log(`${tableName} synced successfully:`, response?.data);
    updateRealmSyncStatus(tableName, Number(payload.id), true);
  } catch (error) {
    console.error(`Error syncing ${tableName} to cloud:`, error);
    updateRealmSyncStatus(tableName, Number(payload.id), false);
  }
};

const updateRealmSyncStatus = (tableName: string, id: number, synced: boolean) => {
  try {
    realm.write(() => {
      const record = realm.objectForPrimaryKey(tableName, id);
      if (record) {
        record.synced = synced;
        record.syncTimestamp = new Date();
      } else {
        console.log(`${tableName} with ID ${id} not found in Realm.`);
      }
    });
  } catch (error) {
    console.error(`Error updating sync status for ${tableName}:`, error);
  }
};

////////////////////////////////////////  
// Database functions for GPT responses //
////////////////////////////////////////

interface GPTResponseInput {
  discussionId: number;
  response: string;
  responseType: string;
}

/**
 * Adds or updates a GPT response in the database.
 *  - when user asks a question the initial OpenAI response is to split the question into categories
 *    and passing them to GPTs
 *  - each GPT will then answer the question and record the response
 * If a response with the same timestamp and discussion ID already exists, it is updated.
 * Otherwise, a new response is created.
 *
 * @param {number} discussionId - The ID of the discussion to associate the response with
 * @param {string} response - The response text from the GPT model
 * @param {string} responseType - The type of response (e.g. text, image, etc.)
 */
/* export async function addOrUpdateGPTResponse(input: GPTResponseInput): Promise<void> {
  try {
    console.log('Adding or updating GPT response...');
    const { discussionId, response, responseType } = input;
    const discussions = realm.objects('Discussion');
    const discussion = realm.objectForPrimaryKey('Discussion', discussionId) as Discussion;
    if (discussion) {
      const timestamp = discussion.timestamp;
      const existingResponse = realm.objects('GPTResponses').filtered('timestamp = $0', timestamp);
      if (existingResponse.length > 0) {
        console.log('Updating existing response...');
        realm.write(() => {
          existingResponse[0]['discussionId'] = discussionId;
          existingResponse[0]['response'] = response;
          existingResponse[0]['responseType'] = responseType;
          existingResponse[0]['cleared'] = false;
        });
      } else {
        console.log('2d5f-No existing response found. Creating new response...');
        realm.write(() => {
          const prompt = discussion.description;
          realm.create('GPTResponses', {
            id: new Date().getTime(),
            discussionId,
            timestamp,
            prompt,
            response,
            responseType,
            cleared: false,
          });
        });
        console.log('New response created.');
      }
    } else {
      console.log(`No discussion found with ID: ${discussionId}`);
    }
  } catch (error) {
    console.error('Error adding or updating GPT response:', error);
  }
} */

export class DiscussionModel extends Realm.Object<DiscussionModel> {
  id!: number;
  timestamp!: number;
  description!: string;
  cleared!: boolean;

  static schema: Realm.ObjectSchema = {
    name: 'Discussion',
    primaryKey: 'id',
    properties: {
      id: 'int',
      timestamp: 'int',
      description: 'string',
      cleared: 'bool',
    },
  };
}
export class GPTResponse extends Realm.Object {
  // Declare your property types:
  response!: string;
  id!: number;
  discussionId!: number;
  timestamp!: number;
  cleared!: boolean;

  // Define the schema to match how you store it in Realm
  static schema: Realm.ObjectSchema = {
    name: 'GPTResponses',         // must match your collection name
    primaryKey: 'id',             // if your primary key is 'id'
    properties: {
      id: 'int',
      response: 'string',
      discussionId: 'int',
      timestamp: 'int',
      cleared: 'bool',
    },
  };
}

import Realm from 'realm';
import axios from 'axios';

export class GPTResponseModel extends Realm.Object<GPTResponseModel> {
  response!: string;  // exclamation mark = non-null

  // define the schema
  static schema: Realm.ObjectSchema = {
    name: 'GPTResponses',
    primaryKey: 'id',
    properties: {
      id: 'int',
      response: 'string',
      // ... other fields ...
    },
  };
}

export class GPTResponseModel2 extends Realm.Object<GPTResponseModel> {
  id!: number;
  discussionId!: number;
  category!: string;
  description!: string;
  responseType!: string;

  static schema: Realm.ObjectSchema = {
    name: 'GPTResponses',
    primaryKey: 'id',
    properties: {
      id: 'int',
      discussionId: 'int',
      category: 'string',
      description: 'string',
      responseType: 'string',
    },
  };
}


export async function addOrUpdateActivityLog(): Promise<void> {
  try {
    interface GPTResponseJSONData {
      category: string;
      parsedDescription: string;
    }
    // Query for GPTResponses that haven't been cleared yet and require DB update
    const gptResponses = realm
    .objects<GPTResponse>('GPTResponses')
    .filtered('cleared = false and responseType = "updateDB"');
    // Iterate over each GPTResponse
    gptResponses.forEach((gptResponse: { [x: string]: any; response: any; id?: number; discussionId?: number; timestamp?: number; cleared?: boolean; }) => {
      console.log(gptResponse.response);   // typed as string
      // Cast or type the object so we can safely access its props
      const gptResponseTyped = gptResponse as {
        [x: string]: any;
        response: string;
        id: number;
        discussionId: number;
        timestamp: number;
        cleared: boolean;
      };

      // Debug check: see the raw JSON string stored
      console.log('Raw GPT response JSON:', gptResponseTyped.response);

      // Parse the raw JSON from the 'response' field
      const responseJson = JSON.parse(gptResponseTyped.response) as GPTResponseJSONData;

      // Log the parsed output (just for clarity/debug)
      console.log('Parsed category:', responseJson.category);
      console.log('Parsed description:', responseJson.parsedDescription);

      // Extract fields we need
      const category = responseJson.category;
      const parsedDescription = responseJson.parsedDescription;
      const discussionId = gptResponseTyped.discussionId;
      const timestamp = gptResponseTyped.timestamp;

      // Check if there's an existing ActivityLog with the same discussionId
      const activityLog = realm.objectForPrimaryKey('ActivityLog', discussionId);

      // If found, update it
      if (activityLog) {
        console.log('98f3 Updating existing response...');
        realm.write(() => {
          activityLog.category = category;
          activityLog.description = parsedDescription;
          activityLog.responseType = 'tell';
          activityLog.cleared = true;
        });
      }
      // Otherwise, create a new record
      else {
        console.log('7y3d No existing activity log found. Creating new activity log...');
        realm.write(() => {
          realm.create('ActivityLog', {
            id: new Date().getTime(),
            discussionId,
            category,
            description: parsedDescription,
            timestamp,
            cleared: true,
          });
        });
        console.log('New response created.');
      }

      // Finally, mark the GPTResponse itself as cleared
      realm.write(() => {
        gptResponseTyped.cleared = true;
      });
    });
  } catch (error) {
    console.error('Error adding or updating GPT response:', error);
  }
}


export async function getDiscussions(): Promise<Discussion[]> {
  try {
    // Type the query: realm.objects<DiscussionModel>('Discussion')
    const results = realm.objects<DiscussionModel>('Discussion').sorted('timestamp', true);
    return results.map((discussion: { id: any; timestamp: string | number | Date; description: any; cleared: any; }) => ({
      id: discussion.id,
      // Convert from a number to a Date
      timestamp: new Date(discussion.timestamp),
      description: discussion.description,
      cleared: discussion.cleared,
    }));
    
  } catch (error) {
    console.error('Error getting discussions:', error);
    return Promise.reject(error);
  }
}


interface GPTSpecialty {
  id: number;
  name: string;
  url: string;
  apiKey: string;
}

/* async function getListOfGPTs(): Promise<GPTSpecialty[]> {
  try {
    const realm = await Realm.open({
      schema: [GPTSpecialtiesSchema],
    });

    const gptSpecialties = realm.objects('GPTSpecialties');
    const listOfGPTs = gptSpecialties.map((specialty) => {
      const gptSpecialty = specialty as unknown as Realm.Object<typeof GPTSpecialtiesSchema, never>;
      return {
        id: gptSpecialty['id'],
        name: gptSpecialty['name'],
        url: gptSpecialty['url'],
        apiKey: gptSpecialty['apiKey'],
      };
    });

    return Promise.resolve(listOfGPTs as GPTSpecialty[]);
  } catch (error) {
    console.error('Error getting list of GPTs:', error);
    return Promise.reject(error);
  }
} */


export class GPTSpecialtyModel extends Realm.Object<GPTSpecialtyModel> {
  name!: string;
  url!: string;
  apiKey!: string;

  static schema: Realm.ObjectSchema = {
    name: 'GPTSpecialties',
    primaryKey: 'name', // or whatever your primary key is
    properties: {
      name: 'string',
      url: 'string',
      apiKey: 'string',
    },
  };
}

// For your return type
export interface gptUrls {
  url: string;
  apiKey: string;
}

export async function getURLofGPT(gpt_name: string): Promise<gptUrls> {
  try {
    // Type is Realm.Results<GPTSpecialtyModel>
    const gptSpecialties = realm.objects<GPTSpecialtyModel>('GPTSpecialties');
    
    // optional filtering:
    // const filtered = gptSpecialties.filtered("name == $0", gpt_name);
    
    // map directly from gptSpecialties or filtered
    const GPT = gptSpecialties.map((specialty: { url: any; apiKey: any; }) => ({
      url: specialty.url,
      apiKey: specialty.apiKey,
    }));

    if (GPT.length === 0) {
      throw new Error(`No GPTSpecialty found for name: ${gpt_name}`);
    }

    return GPT[0];
  } catch (error) {
    console.error('Error getting GPT:', error);
    return Promise.reject(error);
  }
}

/**
 * Send the initial user question to OpenAI to be split up into categories and appropriate GPT assignments
 * @param {string} question The question to be analyzed
 * @returns {Promise<number>}
 */
async function addQuestionDiscussion(question: string, discussionId: number): Promise<number> {
  try {
    addOrUpdateDiscussion(question, 'ask', discussionId);
    // Get GPT names
    const gpts_names_string = '["openAI", "Gemini", "ChatGPT", "Claude", "Bard"]';
    const gpts_names = JSON.parse(gpts_names_string);

    // Get the list of categories
    const categories = await getDistinctCategories();

    // For demonstration, we're faking the response from sendQuestionForParsing:
    // const response = await sendQuestionForParsing({ categories, gpts_names, question, discussionId });
    const response = {
      parts: [
        {
          category: 'Nutrition',
          gpt: 'ChatGPT',
          parsedDescription: "Opinion on the individual's current eating habits and food choices.",
        },
      ],
    };

    const id = new Date().getTime();

    // Save the response with responseType="parsed question"
    realm.write(() => {
      realm.create('GPTResponses', {
        id: id,
        timestamp: new Date(),
        discussionId: discussionId,
        prompt: question,
        response: JSON.stringify(response),
        responseType: 'parsed question',
        cleared: false,
      });
    });
    return Promise.resolve(id);
  } catch (error) {
    console.error('Error adding question discussion:', error);
    return Promise.reject(error);
  }
}

const updateGPTSpecialties = async (gptSpecialty: {
  id?: number;
  name: string;
  url: string;
  apiKey: string;
}) => {
  const url = 'https://your-api-url.com/gpt-specialties';
  const method = gptSpecialty.id ? 'PUT' : 'POST';
  const headers = {
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify(gptSpecialty);

  try {
    const response = await fetch(url, { method, headers, body });
    const json = await response.json();
    return json;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

async function disperseQuestion(discussionId: number, GPT_ResponseId: number) {
  try {
    const discussion = realm.objectForPrimaryKey('Discussion', discussionId);
    if (discussion) {
      const GPT_Response = realm.objectForPrimaryKey('GPTResponses', GPT_ResponseId);
      if (GPT_Response) {
        const parsedQuestion = JSON.parse(GPT_Response.response as string);

        for (const part of parsedQuestion.parts) {
          const gpt = part.gpt;
          const category = part.category;
          const question = part.parsedDescription;

          console.log(`Sending question to GPT ${gpt} for category ${category}:`, question);
          const response = await sendQuestion({ category, gpt, question, discussionId: String(discussionId) });
          console.log(`Got response from GPT ${gpt} for category ${category}:`, response);

          // If you want to store each GPT’s response, you could:
          /*
          realm.write(() => {
            realm.create('GPTResponses', {
              id: new Date().getTime(),
              timestamp: new Date(),
              prompt: question,
              response: response,
              responseType: 'gpt response',
              discussionId: discussionId,
              cleared: false
            });
          });
          */
        }
      } else {
        console.error('GPT Response not found');
      }
    } else {
      console.log(`No discussion found with ID: ${discussionId}`);
    }
  } catch (error) {
    console.error('Error dispersing question:', error);
  }
}

/**
 * Gets all GPT responses for the given question and discussion ID.
 *
 * @param {number} discussionId - The ID of the discussion to get GPT responses for.
 * @returns {Promise<void>}
 */
export async function getGPTResponses(discussionId: unknown) {
  try {
    const discussion = realm.objectForPrimaryKey('Discussion', discussionId);
    if (discussion) {
      const gptResponses = realm.objects('GPTResponses').filtered('discussionId = $0', discussionId);
      const allResponses = realm.objects<GPTResponseModel>('GPTResponses');

      let summary = '';
  /*     gptResponses.forEach((response: { response: string; }) => {
        // Example of accumulating the responses into a summary:
        summary += `${response.response as string}\n`;
      }); */

      allResponses.forEach((item: { response: string; }) => {
        console.log(item.response); // TypeScript knows it's string
        summary += `${item.response as string}\n`;
      });

      console.log('Summary:', summary);
      return summary;
    }
  } catch (error) {
    console.error('Error getting GPT responses by category:', error);
  }
}

async function getDescriptionsWithTimestamps(categories: string[]): Promise<string> {
  const descriptionsWithTimestamps: { description: string; timestamp: string }[] = [];

  const activityLogs = await realm.objects('ActivityLog').filtered('category IN $0', categories);

  for (const activityLog of activityLogs) {
    const description = activityLog.description as string;
    const t = activityLog.timestamp as Date;
    const timestamp = t.toISOString();
    descriptionsWithTimestamps.push({ description, timestamp });
  }

  const jsonString = JSON.stringify(descriptionsWithTimestamps);
  return jsonString;
}

export function getActivityLogs(): ActivityLog[] {
  return Array.from(realm.objects('ActivityLog'));
}

export function getParameters(): Parameters[] {
  return Array.from(realm.objects('Parameters'));
}

export class DatabaseService {
  async parseAndSaveInstructions(jsonData: any) {
    const instructions = jsonData.instructions;
    instructions.forEach(async (instruction: any) => {
      const discussion = await this.getDiscussionById(instruction.id);
      if (discussion) {
        const timestamp = discussion.timestamp;
        const existingLog = await this.getActivityLogByTimestamp(timestamp);
        if (existingLog) {
          // Update existing log
          existingLog.category = instruction.category;
          existingLog.description = instruction.description;
          await this.updateActivityLog(existingLog);
        } else {
          // Create new log
          const newLog: ActivityLog = {
            id: new Date().getTime(),
            discussionId: discussion.id,
            category: instruction.category,
            description: instruction.description,
            timestamp: timestamp,
            cleared: null,
          };
          await this.addActivityLog(newLog);
        }
      } else {
        console.log(`Discussion with ID ${instruction.id} not found.`);
      }
    });
  }

  async getDiscussionById(id: string): Promise<Discussion | null> {
    const discussion = await this.getDiscussionFromDatabase(id);
    return discussion;
  }

  async getDiscussionFromDatabase(id: string): Promise<Discussion | null> {
    //const realm = await Realm.open({ /* schema and other options */ });
    const discussion = realm.objectForPrimaryKey('Discussion', id);
    return discussion as Discussion | null;
  }

  async getExistingLog(timestamp: Date): Promise<ActivityLog | null> {
    const log = await this.getActivityLogByTimestamp(timestamp);
    return log;
  }

  async getActivityLogByTimestamp(timestamp: Date): Promise<ActivityLog | null> {
    const log = await this.getExistingLog(timestamp);
    return log;
  }

  async updateActivityLog(log: ActivityLog): Promise<void> {
    // Implement logic to update an existing ActivityLog in the database
  }

  async addActivityLog(log: ActivityLog): Promise<void> {
    // Implement logic to add a new ActivityLog to the database
  }
}

/**
 * Updates the ActivityLog table by iterating over the GPTResponses table and
 * finding entries with a responseType of "updateDB". These entries are then
 * processed to create a new ActivityLog entry with the corresponding discussion
 * ID and timestamp.
 */
async function updateActivityLog(): Promise<void> {
  try {
    const responses = realm
      .objects<GPTResponseModel2>('GPTResponses')
      .filtered('responseType = "updateDB"');

    responses.forEach((response: { discussionId: any; id: any; }) => {
      const discussionId = response.discussionId;
      const discussion = realm.objectForPrimaryKey('Discussion', discussionId);

      if (discussion && !discussion.cleared) {
        const id = new Date().getTime();
        const timestamp = discussion.timestamp;

        // If your GPTResponses schema has fields 'category' and 'description':
        const category = (response as any).category;
        const description = (response as any).description;

        realm.write(() => {
          try {
            const activityLog = realm.objectForPrimaryKey('ActivityLog', response.id);
            if (activityLog) {
              activityLog.id = id;
              activityLog.timestamp = timestamp;
              activityLog.category = category;
              activityLog.description = description;
              activityLog.discussionId = discussionId;
              realm.create('ActivityLog', activityLog);
            } else {
              realm.create('ActivityLog', {
                id,
                timestamp,
                category,
                description,
                discussionId,
              });
            }
          } catch (error) {
            console.error('Error updating activity log:', error);
          }
        });

        realm.write(() => {
          discussion.cleared = true;
        });
      }
    });
  } catch (error) {
    console.error('Error opening realm:', error);
  }
}

// Moved this function OUT of updateActivityLog so it doesn't break the scope:
function deleteGPTResponsesWithInvalidCategory(): void {
  realm.write(() => {
    // typed with GPTResponseModel
    const gptResponses = realm.objects<GPTResponseModel>('GPTResponses');
    gptResponses.forEach((gptResponse) => {
      const responseJson = JSON.parse(gptResponse.response);
      if (!responseJson.category) {
        realm.delete(gptResponse);
      }
    });
  });
}


export function getNextActiveAlert(): any | null {
  try {
    const activeAlerts = realm
      .objects('Alert')
      .filtered('isActive == true')
      .sorted('nextTrigger', true);

    if (activeAlerts.length > 0) {
      const nextAlert = activeAlerts[0];
      console.log(`Next active alert:`, nextAlert);
      return nextAlert;
    } else {
      console.log('No active alerts found.');
      return null;
    }
  } catch (error) {
    console.error('Error in getNextActiveAlert:', error);
    return null;
  }
}

export async function addOrUpdateAlert(alertData: { [key: string]: any; _id?: any }): Promise<void> {
  try {
    realm.write(() => {
      const existingAlert = realm.objectForPrimaryKey('Alert', alertData._id);

      if (existingAlert) {
        Object.keys(alertData).forEach((key) => {
          existingAlert[key] = alertData[key];
        });
        console.log(`Updated alert with ID: ${alertData._id}`);
      } else {
        realm.create('Alert', {
          ...alertData,
          createdAt: new Date(),
        });
        console.log(`Added new alert with ID: ${alertData._id}`);
      }
    });
  } catch (error) {
    console.error('Error in addOrUpdateAlert:', error);
  }
}

function deactivateAlertByKey(key: any): void {
  try {
    realm.write(() => {
      const alert = realm.objectForPrimaryKey('Alert', key);

      if (alert) {
        alert.isActive = false;
        console.log(`Alert with key ${key} has been deactivated.`);
      } else {
        console.log(`No alert found with the key: ${key}`);
      }
    });
  } catch (error) {
    console.error(`Error while deactivating alert with key ${key}:`, error);
  }
}

export async function deleteDiscussion(id: number): Promise<void> {
  try {
    realm.write(() => {
      const discussion = realm.objectForPrimaryKey('Discussion', id);

      if (discussion) {
        console.log('Deleting discussion...');
        realm.delete(discussion);
        console.log('Deleted discussion: ', discussion);
      } else {
        console.log(`No discussion found with ID ${id}.`);
      }
    });
  } catch (error) {
    console.error(`Error deleting discussion with ID ${id}:`, error);
  }
}

// Re-exporting fixed or existing functions:
// Re-exporting fixed or existing functions:
export {
  getDistinctCategories,
  insertJsonFile,
 // queryAllFieldsByCategories,
  addDiscussion,
  disperseQuestion,
  addQuestionDiscussion,
  getDescriptionsWithTimestamps, type ActivityLog
};
