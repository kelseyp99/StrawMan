import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Workaround for TypeScript error: getReactNativePersistence not found
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: any) => any;
};

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebase?.apiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDba17ybV3s_h6gcZSP1-9nGgaALc1_2Pk",
  authDomain: Constants.expoConfig?.extra?.firebase?.authDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "lifelog-f2904.firebaseapp.com",
  projectId: Constants.expoConfig?.extra?.firebase?.projectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "lifelog-f2904",
  storageBucket: Constants.expoConfig?.extra?.firebase?.storageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "lifelog-f2904.appspot.com",
  messagingSenderId: Constants.expoConfig?.extra?.firebase?.messagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "341732508688",
  appId: Constants.expoConfig?.extra?.firebase?.appId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:341732508688:android:4063fe724164fa1c18f695"
};

console.log("Firebase Config:", firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);