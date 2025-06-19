import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Declare getReactNativePersistence to fix TypeScript error
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: any): any;
}
import { getReactNativePersistence } from 'firebase/auth';

// Check if we should enable Firebase (set to false for offline-first mode)
const ENABLE_FIREBASE = false;

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebase?.apiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDba17ybV3s_h6gcZSP1-9nGgaALc1_2Pk",
  authDomain: Constants.expoConfig?.extra?.firebase?.authDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "lifelog-f2904.firebaseapp.com",
  projectId: Constants.expoConfig?.extra?.firebase?.projectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "lifelog-f2904",
  storageBucket: Constants.expoConfig?.extra?.firebase?.storageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "lifelog-f2904.appspot.com",
  messagingSenderId: Constants.expoConfig?.extra?.firebase?.messagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "341732508688",
  appId: Constants.expoConfig?.extra?.firebase?.appId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:341732508688:android:4063fe724164fa1c18f695"
};

console.log("Firebase Enabled:", ENABLE_FIREBASE);
if (ENABLE_FIREBASE) {
  console.log("Firebase Config:", firebaseConfig);
}

// Initialize Firebase only if enabled
let app: any = null;
let auth: any = null;
let db: any = null;

if (ENABLE_FIREBASE) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  db = getFirestore(app);
} else {
  // Mock Firebase services for offline mode
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
    signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase disabled')),
    createUserWithEmailAndPassword: () => Promise.reject(new Error('Firebase disabled')),
    signOut: () => Promise.reject(new Error('Firebase disabled')),
  };
  db = {
    // Mock Firestore methods to prevent errors
    collection: () => ({ 
      doc: () => ({ 
        get: () => Promise.reject(new Error('Firebase disabled')),
        set: () => Promise.reject(new Error('Firebase disabled')),
        update: () => Promise.reject(new Error('Firebase disabled')),
        delete: () => Promise.reject(new Error('Firebase disabled')),
      }),
      add: () => Promise.reject(new Error('Firebase disabled')),
      get: () => Promise.reject(new Error('Firebase disabled')),
    }),
    doc: () => ({ 
      get: () => Promise.reject(new Error('Firebase disabled')),
      set: () => Promise.reject(new Error('Firebase disabled')),
      update: () => Promise.reject(new Error('Firebase disabled')),
      delete: () => Promise.reject(new Error('Firebase disabled')),
    }),
  };
}

export { auth, db };