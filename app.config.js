// NOTE: This project uses the bare workflow with native folders (android/ios).
// Expo doctor will warn about config fields not syncing automatically.
// This is expected and safe to ignore unless you use `expo prebuild`.
require('dotenv').config();

// Export a plain object instead of a function to ensure EAS/Metro always picks up the config
const isLive = process.env.AD_MOB_ENV === 'live';

module.exports = {
  // Note: Removed react-native-google-mobile-ads config plugin usage because the package
  // doesn't ship a valid Expo config plugin. Ads still work in native with manual setup.
  expo: {
    name: 'StrawMan',
    slug: 'strawman',
    owner: 'tinman42',
  scheme: 'strawman',
    icon: './assets/images/ask-janet-icon2.png',
    android: {
      package: 'com.smartcitiesfl.strawman',
    },
    ios: {
      bundleIdentifier: 'com.smartcitiesfl.strawman',
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    updates: {
      enabled: true,
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
      runtimeVersion: '1.1.0-strawman-dev'
    },
    extra: {
      EXPO_PUBLIC_IS_EXPO_GO: process.env.EXPO_PUBLIC_IS_EXPO_GO || 'true',
  // TODO: Replace these with the OAuth 2.0 Client IDs created for strawman-42 in Google Cloud Console
  // Android: needs SHA-1 + SHA-256 fingerprints registered in Firebase to download a valid google-services.json
  googleClientIdAndroid: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || 'REPLACE_ME_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  // iOS: create iOS OAuth client with bundle com.smartcitiesfl.strawman
  googleClientIdIos: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || 'REPLACE_ME_IOS_CLIENT_ID.apps.googleusercontent.com',
      firebase: {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC1dU8xLrg-c7qS_ALHBi3p1VuH049vePk',
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'strawman-42.firebaseapp.com',
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'strawman-42',
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'strawman-42.firebasestorage.app',
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '894321564476',
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:894321564476:android:4845037cdd1169f2e25c39'
      },
      eas: {
  projectId: 'a27bcb78-af2a-4ef8-adeb-7fae3e17731d',
      },
    },
  plugins: ['expo-asset'],
  },
  // Provide top-level config for RNGoogleMobileAds build phase lookup (mirrors app.json)
  'react-native-google-mobile-ads': {
    android_app_id: 'ca-app-pub-3940256099942544~3347511713',
    ios_app_id: 'ca-app-pub-3940256099942544~1458002511',
  },
};
