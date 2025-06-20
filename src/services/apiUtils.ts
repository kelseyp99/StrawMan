import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ModelAPIkey {
  aiModel: string;
  apiKey: string;
  endPointURL: string;
}

export const getModelAPIkey = async (): Promise<ModelAPIkey | null> => {
  try {
    // Get API key from local storage (offline-first approach)
    const localApiKey = await AsyncStorage.getItem('userApiKey');
    if (localApiKey) {
      return { 
        apiKey: localApiKey,
        aiModel: 'gpt-3.5-turbo', // Default model
        endPointURL: 'https://api.openai.com/v1' // Default OpenAI endpoint
      };
    }
    
    return null;
  } catch (error) {
    console.log('Error getting API key from local storage:', error);
    return null;
  }
};