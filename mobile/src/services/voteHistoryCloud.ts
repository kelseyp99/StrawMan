import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfig } from '../../src/firebaseConfig';
import { initializeApp } from 'firebase/app';
import { getUID } from '../utils/uidManager';

// Initialize Firebase app and functions
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

export async function getUserVoteHistoryCloud(): Promise<any[]> {
  const userId = await getUID();
  if (!userId) throw new Error('No user is logged in');
  const getUserVoteHistory = httpsCallable(functions, 'getUserVoteHistory');
  const result = await getUserVoteHistory({ userId });
  if (result && result.data && Array.isArray(result.data.votes)) {
    return result.data.votes;
  }
  return [];
}
