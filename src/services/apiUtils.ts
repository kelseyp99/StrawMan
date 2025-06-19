import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ModelAPIkey {
  aiModel: string;
  apiKey: string;
  endPointURL: string;
}

export const getModelAPIkey = async () => {
  try {
    // Get API key from local storage (offline-first approach)
    const localApiKey = await AsyncStorage.getItem('userApiKey');
    if (localApiKey) {
      return { apiKey: localApiKey };
    }
    
    return null;
  } catch (error) {
    console.log('Error getting API key from local storage:', error);
    return null;
  }
};