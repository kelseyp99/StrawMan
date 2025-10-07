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
  // Ensure elections object exists
  if (!userData.elections) {
    userData.elections = {};
  }
  const electionData = userData.elections[electionId] || {};
  const hasVoted = electionData.hasVoted || false;
  const lastCandidateId = electionData.selectedId || null;


  // Create candidate outside transaction if missing
  try {
    const candidateSnap = await candidateRef.get();
    if (!candidateSnap.exists) {
      await candidateRef.set({
        id: candidateId,
        electionId: electionId,
        voteTally: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('Error ensuring candidate exists:', err);
    throw new functions.https.HttpsError('internal', 'Failed to ensure candidate exists.');
  }

  // All voting logic in transaction
  try {
    await db.runTransaction(async (t) => {
      try {
        // If user has voted before, decrease previous candidate's tally
        if (hasVoted && lastCandidateId && lastCandidateId !== candidateId) {
          const prevCandidateRef = db.collection('candidates').doc(lastCandidateId);
          const prevCandidateDoc = await t.get(prevCandidateRef);
          if (prevCandidateDoc.exists) {
            t.update(prevCandidateRef, { voteTally: admin.firestore.FieldValue.increment(-1) });
            console.log(`[castVote] Decremented voteTally for previous candidate ${lastCandidateId}`);
          } else {
            console.warn(`[castVote] Previous candidate ${lastCandidateId} does not exist, skipping decrement.`);
          }
        }
        // Always set (merge) the candidate doc to ensure it exists, then increment tally
        t.set(candidateRef, {
          id: candidateId,
          electionId: electionId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        t.update(candidateRef, { voteTally: admin.firestore.FieldValue.increment(1) });
        console.log(`[castVote] Set and incremented voteTally for candidate ${candidateId}`);
        // Update user voting record, ensuring elections object exists
        t.set(userRef, {
          ...userData,
          elections: {
            ...userData.elections,
            [electionId]: {
              hasVoted: true,
              selectedId: candidateId,
            },
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`[castVote] Updated user voting record for user ${userId}`);

        // Also write to Users/{userId}/Elections/{electionId} for compatibility

        const userElectionRef = db.collection('Users').doc(userId).collection('Elections').doc(electionId);
        t.set(userElectionRef, {
          hasVoted: true,
          selectedId: candidateId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`[castVote] Updated Users/${userId}/Elections/${electionId}`);

        // Also write to Users/{userId}/Votes/{voteId} for vote history table
        // Fetch candidate name for vote history
        let candidateName = candidateId;
        try {
          const candidateDoc = await candidateRef.get();
          if (candidateDoc.exists && candidateDoc.data().name) {
            candidateName = candidateDoc.data().name;
          }
        } catch (err) {
          console.warn(`[castVote] Could not fetch candidate name for ${candidateId}:`, err);
        }
        const userVotesRef = db.collection('Users').doc(userId).collection('Votes').doc();
        t.set(userVotesRef, {
          candidateId,
          electionId,
          name: candidateName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[castVote] Added vote to Users/${userId}/Votes/`);

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
        console.log(`[castVote] Added to candidateResultHistory for candidate ${candidateId}`);
      } catch (err) {
        console.error('[castVote] Error inside transaction:', err);
        throw err;
      }
    });
  } catch (err) {
    console.error('Error in voting transaction:', err);
    throw new functions.https.HttpsError('internal', 'Voting transaction failed.');
  }

  return { success: true };
});

// Cloud Function to get all votes for a user from candidateResultHistory
exports.getUserVoteHistory = functions.https.onCall(async (data, context) => {
  const { userId } = data;
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameter: userId');
  }
  try {
    // Fetch all votes for this user from candidateResultHistory collection
    const votesRef = db.collection('candidateResultHistory').where('uid', '==', userId);
    const snapshot = await votesRef.get();
    const votes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        selectedId: data.selectedId,
        timestamp: data.timestamp,
        electionId: data.electionId,
      };
    }).sort((a, b) => {
      // Sort by timestamp descending (newest first)
      const aTime = a.timestamp?.seconds || 0;
      const bTime = b.timestamp?.seconds || 0;
      return bTime - aTime;
    });
    console.log(`[getUserVoteHistory] Returning ${votes.length} votes for user ${userId}`);
    return { votes };
  } catch (err) {
    console.error('[getUserVoteHistory] Error:', err);
    throw new functions.https.HttpsError('internal', 'Failed to fetch user vote history.');
  }
});
