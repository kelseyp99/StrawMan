import axios, { AxiosError } from 'axios';
//import dotenv from 'dotenv';
// @ts-ignore
import Config from 'react-native-config';
import {
  addOrUpdateGPTResponse,
  clearDiscussion,
  getURLofGPT,
  queryAllFieldsByCategories,
} from './dbServices';
const API_URL = Config.API_URL;
// Load environment variables from .env

/**
 * shareTextAndFile
 *
 * This async function creates a text file with the content provided,
 * then opens the share dialog with the file attached and a custom message.
 *
 * It uses:
 * - react-native-fs to write the file to the device’s document directory.
 * - react-native-share to open the share sheet.
 *
 * Note: Actual support for pre-populating text and attaching the file depends on the target app.
 */

export interface ModelAPIkey {
  aiModel: string;
  apiKey: string;
  endPointURL: string;
}

export interface ActivityInput {
  categories: string[];
  description: string;
}

export interface ParsedActivity {
  category: string;
  parsedDescription: string;
}

import { getModelAPIkey } from './apiUtils';

let cachedAiModel: string | null = null;
let cachedApiKey: string | null = null;
let cachedEndPointURL: string | null = null;

// ✅ Function to get the API Key (fetch once, then reuse)
const getAPIKey = async (): Promise<ModelAPIkey> => {
  if (cachedApiKey) {
    // console.log("Returning cached API key.");
    // console.log("Fetched API Model:", cachedAiModel);
    // console.log("Fetched API Key:", cachedApiKey);
    // console.log("Fetched EndPoint URL:", cachedEndPointURL);
    return {
      aiModel: cachedAiModel!,
      apiKey: cachedApiKey!,
      endPointURL: cachedEndPointURL!,
    };
  }

  try {
    const key = await getModelAPIkey();
    if (!key) throw new Error('API Key not found');
    // console.log("Fetched API Model:", key.aiModel);
    // console.log("Fetched API Key:", key.apiKey);
    // console.log("Fetched EndPoint URL:", key.endPointURL);
    cachedAiModel = key.aiModel;
    cachedApiKey = key.apiKey;
    cachedEndPointURL = key.endPointURL;
    return key;
  } catch (error) {
    console.error('Error fetching API Key:', error);
    throw error;
  }
};

// ✅ Function to send a request to OpenAI API
export const fetchAIResponse = async (input: string): Promise<any> => {
  try {
    const aiConnection = await getAPIKey();
    const { aiModel, apiKey, endPointURL } = aiConnection;
    console.log('Using API model:', aiModel);
    console.log('Using API Key:', apiKey);
    console.log('Using EndPoint URL:', endPointURL);
    const response = await fetch(endPointURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error fetching AI response:', error);
    throw error;
  }
};

export const analyzeActivity = async (
  input: ActivityInput
): Promise<ParsedActivity> => {
  try {
    const { categories, description } = input;
    console.log('Debug: Received input:', input);
    const aiConnection = await getAPIKey();
    const { aiModel, apiKey, endPointURL } = aiConnection;
    console.log('Using API model:', aiModel);
    console.log('Using API Key:', apiKey);
    console.log('Using EndPoint URL:', endPointURL);
    if (!cachedEndPointURL) {
      throw new Error('API endpoint URL is not set.');
    }
    //const url = cachedEndPointURL;
    //const url = 'https://api.openai.com/v1/chat/completions';
    // Prompt setup with categories and user activity
    const systemPrompt = `
      You are a data parsing assistant. Your task is to analyze activities and assign them to the most relevant category. 
      The list of predefined categories, if any, is: ${categories.join(
        ', '
      )}. However, if an activity does not fit into an existing category, create a new appropriate category.
      Add additional appropriate catagories if needed for the activity. 

      For each activity description provided, return a JSON object with:
      - "category": The most relevant category from the list, or a newly created category if necessary.
      - "parsedDescription": A **shortened and concise** version of the activity description, **not a redefinition**.

      Ensure that the output remains **concise** and that unnecessary explanations are omitted.`;

    const userPrompt = `Here is the activity description: "${description}". 
    Please analyze and categorize this activity.`;

    console.log('Debug: Sending request to OpenAI API.');
    console.log('Debug: System Prompt:', systemPrompt);
    console.log('Debug: User Prompt:', userPrompt);
    //if (true) return { category: 'Uncategorized', parsedDescription: 'No description provided.' };
    // const apiKey = await getAPIKey(); // Ensure key is available
    //console.log("Using API Key:", apiKey);

    const response = await axios.post(
      endPointURL,
      {
        //model: 'text-ada-001',
        // model: 'gpt-4',
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      const responseText = response.data.choices[0].message.content;
      // Parse the response JSON returned from OpenAI
      const result: ParsedActivity = JSON.parse(responseText);
      console.log('Debug: Final Parsed Result:', result);
      return result;
    } else {
      console.warn('Debug: No valid response from OpenAI.');
      return {
        category: 'Uncategorized',
        parsedDescription: 'Unable to parse activity.',
      };
    }
  } catch (error) {
    const errorAsError = error as AxiosError;
    console.error('Error during OpenAI API call:', errorAsError);

    if (errorAsError.response) {
      const status = errorAsError.response.status;
      console.error('Error status:', status);
      console.error('Error details:', errorAsError.response.data);

      if (status === 429) {
        console.error(
          'Quota exceeded: Ensure your account has sufficient quota or reduce request volume.'
        );
        // Optional: Add logic to retry after some delay
      }
    } else {
      console.error('Error details:', errorAsError.message);
    }
    throw errorAsError;
  }
};

interface QuestionInputForParsing {
  categories: string[];
  gpts_names: string[];
  question: string;
  discussionId: string;
}

export const sendQuestionForParsing = async (
  input: QuestionInputForParsing
): Promise<ParsedActivity> => {
  try {
    // Here we take the user's raw question and send it to the OpenAI API for parsing.
    // The parsing process entails analyzing the question, splitting it into parts,
    // and assigning each part to a relevant category and GPT.
    // This parsed question is then saved to the GPT_Response tabrle as a JSON string.
    // Extract the necessary fields from the input object, which include categories, GPT names,
    // the question to be parsed, and the discussion ID for database tracking.
    const { categories, gpts_names, question, discussionId } = input;
    const aiConnection = await getAPIKey();
    const { aiModel, apiKey, endPointURL } = aiConnection;
    // console.log("Using API Key:", apiKey);
    // console.log("Using EndPoint URL:", endPointURL);

    // Set the URL for the OpenAI API endpoint that we will be interacting with.
    if (!cachedEndPointURL) {
      throw new Error('API endpoint URL is not set.');
    }
    // const url = cachedEndPointURL;
    // Create a new object
    // const myObject = {
    //   paramName: 'openai_url',
    //   paramValue: url
    // };

    // // Add the object to the Realm
    // realm.write(() => {
    //   realm.create('MyObject', myObject);
    // });

    // Define the system prompt. This instructs the AI on what task it needs to perform,
    // which involves analyzing the question, splitting it into parts, and assigning each part
    // to a relevant category and GPT. It also specifies the categories and GPTs available.
    const systemPrompt = `
      You are a data parsing assistant. You will analyze this question and break it up into parts 
      and assign each part all relevant categories, not just one, and best gpt to use. 
      The list of categories is: ${categories.join(', ')}.
      The list of gpts, if any, is: ${gpts_names.join(', ')}.

      For each question part you determine,return a JSON object with:
      - "category": The most relevant category from the list
      - "gpt": The most relevant gpt from the list
      - "parsedDescription": A concise, clear representation of the question part as can be answered by the gpt
      do not answer the question, just parse it.
    `;

    // Define the user prompt. This contains the actual question that we want the AI to parse
    // and categorize according to the instructions in the system prompt.
    const userPrompt = `Here is the question description: "${question}". 
    Please analyze and categorize this activity.`;

    // Log the system and user prompts for debugging purposes.
    console.log('Debug: Sending request to parse question');
    console.log('Debug: System Prompt:', systemPrompt);
    console.log('Debug: User Prompt:', userPrompt);
    //const apiKey = await getAPIKey(); // Ensure key is available
    //console.log("Using API Key:", apiKey);

    // Send a POST request to the OpenAI API with the specified model and messages.
    const response = await axios.post(
      endPointURL,
      {
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    // Log the response from the API for debugging.
    // console.log('Debug: API response:', response.data);

    // Check if the API response contains valid choices.
    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      // Extract the content from the first response choice.
      const responseText = response.data.choices[0].message.content;
      // console.log('Debug: Parsed response:', responseText);

      // Parse the JSON response to obtain the structured ParsedActivity object.
      const result: ParsedActivity = JSON.parse(responseText);
      console.log('Debug: Final Parsed Result:', result);

      // Prepare to update the database with the parsed result.
      const responseType = 'parsed question';
      const stringifiedResponse = JSON.stringify(result);
      await addOrUpdateGPTResponse(
        discussionId,
        stringifiedResponse,
        responseType
      );

      // Return the parsed result to the caller.
      return result;
    } else {
      // Log a warning if the response does not contain valid choices.
      console.warn('Debug: No valid response from OpenAI.');

      // Return a default result if the parsing was unsuccessful.
      return {
        category: 'Uncategorized',
        parsedDescription: 'Unable to parse activity.',
      };
    }
  } catch (error) {
    // Catch and handle errors that occur during the API call.
    const errorAsError = error as AxiosError;
    console.error('Error during OpenAI API call:', errorAsError);

    // If the error contains a response, log additional details.
    if (errorAsError.response) {
      console.error('Error details:', errorAsError.response.data);
      console.error('Error status:', errorAsError.response.status);
    } else {
      // Log the error message if no response is available.
      console.error('Error details:', errorAsError.message);
    }

    // Rethrow the error to allow the caller to handle it.
    throw errorAsError;
  }
};

export interface QuestionInput {
  category: string;
  gpt: string;
  question: string;
  discussionId: string;
}

export const sendQuestion = async (
  input: QuestionInput
): Promise<ParsedActivity> => {
  try {
    const { category, gpt, question, discussionId } = input;
    const aiConnection = await getAPIKey();
    const { aiModel, apiKey, endPointURL } = aiConnection;
    // console.log("Using API Key:", apiKey);
    // console.log("Using EndPoint URL:", endPointURL);
    if (!cachedEndPointURL) {
      throw new Error('API endpoint URL is not set.');
    }
    // const url = cachedEndPointURL;
    // const getDescriptionsWithTimestamps = async (categories: string[]): Promise<any[]> => {
    //   return categories.map(category => ({ category, timestamp: new Date().toISOString() }));
    // };

    // const queryAllFieldsByCategories = async (categories: string[]): Promise<any[]> => {
    //   return categories.map(category => ({ category, timestamp: new Date().toISOString() }));
    // };
    const list = await queryAllFieldsByCategories([category]);
    const listString = list.join(', ');
    //console.log('Debug: vlistString', listString);
    const systemPrompt = `You are a ${category} specialist..`;
    console.log('Debug: System Prompt:', systemPrompt);
    const userPrompt = `Here is the question : "${question}" this is the history : ${listString} be sure to answer the question by using the history`;
    console.log('Debug: User Prompt:', userPrompt);
    const response = await axios.post(
      endPointURL,
      {
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    // console.log('Debug: API response:', response.data);

    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      const responseText = response.data.choices[0].message.content;
      console.log('Debug: Parsed response:', responseText);

      // Parse the response JSON returned from OpenAI
      const responseType = 'parsed answer';
      // const stringifiedResponse = JSON.stringify(result); // Convert ParsedActivity to string
      //const responseText2 = { category: 'testing', parsedDescription: 'testing'};
      await addOrUpdateGPTResponse(
        discussionId,
        responseText,
        responseType,
        true
      );
      return { category: category, parsedDescription: responseText };
    } else {
      console.warn('Debug: No valid response from OpenAI.');
      return {
        category: 'Uncategorized',
        parsedDescription: 'Unable to parse activity.',
      };
    }
  } catch (error) {
    const errorAsError = error as AxiosError;
    console.error('d92k Error during OpenAI API call:', errorAsError);
    if (errorAsError.response) {
      console.error('Error details:', errorAsError.response.data);
      console.error('Error status:', errorAsError.response.status);
    } else {
      console.error('Error details:', errorAsError.message);
    }
    throw errorAsError;
  }
};
