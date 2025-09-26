const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// Cloud Function to handle voting
exports.castVote = functions.https.onCall(async (data, context) => {
  const { userId, electionId, candidateId } = data;
  if (!userId || !electionId || !candidateId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
  }

  const userRef = db.collection('users').doc(userId);
  const candidateRef = db.collection('candidates').doc(candidateId);

  // Get user voting record for this election
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found.');
  }
  const userData = userSnap.data();
  const hasVoted = userData.hasVoted || false;
  const lastCandidateId = userData.selectedId || null;

  // Start a transaction
  await db.runTransaction(async (t) => {
    // If user has voted before, decrease previous candidate's tally
    if (hasVoted && lastCandidateId && lastCandidateId !== candidateId) {
      const prevCandidateRef = db.collection('candidates').doc(lastCandidateId);
      t.update(prevCandidateRef, { voteTally: admin.firestore.FieldValue.increment(-1) });
    }
    // Increase new candidate's tally
    t.update(candidateRef, { voteTally: admin.firestore.FieldValue.increment(1) });
    // Update user voting record
    t.update(userRef, {
      hasVoted: true,
      selectedId: candidateId,
      [`elections.${electionId}.hasVoted`]: true,
      [`elections.${electionId}.selectedId`]: candidateId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Add to candidate result history
    const historyRef = db.collection('candidateResultHistory').doc();
    t.set(historyRef, {
      id: historyRef.id,
      selectedId: candidateId,
      uid: userId,
      hasVoted: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      electionId,
      synced: true,
      syncTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});
