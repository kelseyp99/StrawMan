import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

if (!admin.apps.length) admin.initializeApp();

export const processVote = onCall(async (request) => {
  const { userId, candidateId, candidateName, electionId } = request.data;

  if (!userId || !electionId || (!candidateId && !candidateName)) {
    throw new HttpsError('invalid-argument', 'Missing required fields: userId, electionId, candidateId');
  }

  const db = admin.firestore();
  const candidateKey = candidateId || candidateName;

  try {
    // Check if user has voted in this election before
    const historyRef = db.collection(`users/${userId}/voteHistory`);
    const existing = await historyRef.where('electionId', '==', electionId).orderBy('timestamp', 'desc').limit(1).get();

    const now = admin.firestore.FieldValue.serverTimestamp();
    const candidateTallyRef = db.collection('candidateResults').doc(`${electionId}_${candidateKey}`);

    if (!existing.empty) {
      const lastVote = existing.docs[0].data();
      const lastCandidateKey = lastVote.candidateId || lastVote.candidateName;

      if (lastCandidateKey === candidateKey) {
        // Same candidate — just log, no tally change
        await historyRef.add({ userId, candidateId: candidateKey, candidateName, electionId, timestamp: now, action: 'reaffirmed' });
        return { success: true, message: '✅ Vote reaffirmed (same candidate)' };
      } else {
        // Different candidate — switch vote
        const lastTallyRef = db.collection('candidateResults').doc(`${electionId}_${lastCandidateKey}`);
        await db.runTransaction(async (tx) => {
          const lastSnap = await tx.get(lastTallyRef);
          const newSnap = await tx.get(candidateTallyRef);
          tx.set(lastTallyRef, { votes: Math.max(0, (lastSnap.data()?.votes || 1) - 1) }, { merge: true });
          tx.set(candidateTallyRef, { votes: (newSnap.data()?.votes || 0) + 1, candidateId: candidateKey, candidateName, electionId }, { merge: true });
        });
        await historyRef.add({ userId, candidateId: candidateKey, candidateName, electionId, timestamp: now, action: 'switched', previousCandidateId: lastCandidateKey });
        return { success: true, message: '✅ Vote switched successfully' };
      }
    } else {
      // First vote in this election
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(candidateTallyRef);
        tx.set(candidateTallyRef, { votes: (snap.data()?.votes || 0) + 1, candidateId: candidateKey, candidateName, electionId }, { merge: true });
      });
      await historyRef.add({ userId, candidateId: candidateKey, candidateName, electionId, timestamp: now, action: 'voted' });
      return { success: true, message: '✅ Vote recorded!' };
    }
  } catch (err: any) {
    console.error('[processVote] error:', err);
    throw new HttpsError('internal', err?.message || 'Vote processing failed');
  }
});
