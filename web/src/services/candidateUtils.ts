import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

export async function ensureCandidatesExist(candidates: Array<{ name: string; office: string; party?: string }>) {
  const candidatesRef = collection(db, 'candidates');
  for (const candidate of candidates) {
    console.log('[Candidate Sync] Processing:', candidate.name, candidate.office);
    // Check if candidate already exists (by name and office)
    const q = query(candidatesRef, where('name', '==', candidate.name), where('office', '==', candidate.office));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log('[Candidate Sync] Adding to Firebase:', candidate.name, candidate.office);
      await addDoc(candidatesRef, candidate);
    } else {
      console.log('[Candidate Sync] Already exists:', candidate.name, candidate.office);
    }
  }
}
