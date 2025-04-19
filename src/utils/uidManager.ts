import AsyncStorage from '@react-native-async-storage/async-storage';

export const setUID = async (uid: string) => {
  try {
    await AsyncStorage.setItem('userUID', uid);
    console.log("UID set:", uid);
  } catch (error) {
    console.error("Error setting UID:", error);
  }
};

export const getUID = async (): Promise<string | null> => {
  try {
    const uid = await AsyncStorage.getItem('userUID');
    console.log("UID retrieved from AsyncStorage:", uid);
    return uid;
  } catch (error) {
    console.error("Error getting UID:", error);
    return null;
  }
};

export const clearUID = async () => {
  try {
    await AsyncStorage.removeItem('userUID');
    console.log("UID cleared");
  } catch (error) {
    console.error("Error clearing UID:", error);
  }
};