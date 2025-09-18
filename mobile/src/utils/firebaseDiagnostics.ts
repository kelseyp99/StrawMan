import { ENABLE_FIREBASE, ENABLE_FIRESTORE } from '../firebaseConfig';
import Constants from 'expo-constants';

export function logFirebaseDiagnostics() {
  const extra = Constants.expoConfig?.extra as any;
  const firebase = extra?.firebase;
  console.log('[FIREBASE DIAGNOSTICS] ENABLE_FIREBASE=', ENABLE_FIREBASE, ' ENABLE_FIRESTORE=', ENABLE_FIRESTORE);
  console.log('[FIREBASE DIAGNOSTICS] extra.firebase=', firebase);
  console.log('[FIREBASE DIAGNOSTICS] googleClientIdAndroid=', extra?.googleClientIdAndroid, ' googleClientIdIos=', extra?.googleClientIdIos);
}
