// Firebase config for StrawMan web app
// Use environment variables in development rather than hard-coding secrets.
// Set these in a local .env file (create a .env.local in the project root) or in your shell.
export const firebaseConfig = {
  apiKey: (import.meta.env as any)['REACT_APP_FIREBASE_API_KEY'] || 'AIzaSyC1dU8xLrg-c7qS_ALHBi3p1VuH049vePk',
  authDomain: (import.meta.env as any)['REACT_APP_FIREBASE_AUTH_DOMAIN'] || 'strawman-42.firebaseapp.com',
  projectId: (import.meta.env as any)['REACT_APP_FIREBASE_PROJECT_ID'] || 'strawman-42',
  storageBucket: (import.meta.env as any)['REACT_APP_FIREBASE_STORAGE_BUCKET'] || 'strawman-42.firebasestorage.app',
  messagingSenderId: (import.meta.env as any)['REACT_APP_FIREBASE_MESSAGING_SENDER_ID'] || '894321564476',
  appId: (import.meta.env as any)['REACT_APP_FIREBASE_APP_ID'] || '1:894321564476:android:4845037cdd1169f2e25c39'
};
