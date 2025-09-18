import AsyncStorage from '@react-native-async-storage/async-storage';

export const setUID = async (uid: string) => {
  try {
    await AsyncStorage.setItem('userUID', uid);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error setting UID:', error);
    }
  }
};

export const getUID = async (): Promise<string | null> => {
  try {
    const uid = await AsyncStorage.getItem('userUID');
    return uid;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error getting UID:', error);
    }
    return null;
  }
};

export const clearUID = async () => {
  try {
    await AsyncStorage.removeItem('userUID');
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error clearing UID:', error);
    }
  }
};
