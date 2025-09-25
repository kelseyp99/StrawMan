import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseConfig } from '../../src/firebaseConfig';
import { initializeApp } from 'firebase/app';

// Initialize Firebase app and functions
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

export async function callCastVote({ userId, electionId, candidateId }: { userId: string, electionId: string, candidateId: string }) {
  const castVote = httpsCallable(functions, 'castVote');
  return await castVote({ userId, electionId, candidateId });
}
