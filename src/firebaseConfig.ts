import { initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Declare getReactNativePersistence to fix TypeScript error
declare module 'firebase/auth' {
  // Use 'unknown' for better type safety
  export function getReactNativePersistence(storage: unknown): unknown;
}
import { getReactNativePersistence } from 'firebase/auth';

// Check if we should enable Firebase (set to false for offline-first mode)
const ENABLE_FIREBASE = true; // Enable for authentication
const ENABLE_FIRESTORE = true; // Enable Firestore for paid users

// Default to StrawMan project (override via env or expo.extra.firebase)
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebase?.apiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyC1dU8xLrg-c7qS_ALHBi3p1VuH049vePk", // strawman-42
  authDomain: Constants.expoConfig?.extra?.firebase?.authDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "strawman-42.firebaseapp.com",
  projectId: Constants.expoConfig?.extra?.firebase?.projectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "strawman-42",
  storageBucket: Constants.expoConfig?.extra?.firebase?.storageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "strawman-42.firebasestorage.app",
  messagingSenderId: Constants.expoConfig?.extra?.firebase?.messagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "894321564476",
  appId: Constants.expoConfig?.extra?.firebase?.appId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:894321564476:android:4845037cdd1169f2e25c39"
};

console.log("Firebase Enabled:", ENABLE_FIREBASE);
console.log("Firestore Enabled:", ENABLE_FIRESTORE);
if (ENABLE_FIREBASE) {
  console.log("Firebase Config:", firebaseConfig);
}

// Initialize Firebase only if enabled
import type { FirebaseApp } from 'firebase/app';
import type { Auth as FirebaseAuth, Persistence } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

let app: FirebaseApp | null = null;
let auth: FirebaseAuth | Partial<FirebaseAuth> | null = null;
let db: Firestore | null = null;

if (ENABLE_FIREBASE) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage) as Persistence
  });
  
  db = getFirestore(app) as Firestore;
} else {
  // Mock Firebase services for completely offline mode
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
    signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase disabled')),
    createUserWithEmailAndPassword: () => Promise.reject(new Error('Firebase disabled')),
    signOut: () => Promise.reject(new Error('Firebase disabled')),
  } as Partial<FirebaseAuth>;
  db = null; // Set to null when disabled
}

export { auth, db, ENABLE_FIRESTORE, ENABLE_FIREBASE };