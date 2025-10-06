const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

// Cloud Function to get all votes for a user
const getUserVoteHistory = functions.https.onCall(async (data, context) => {
  const { userId } = data;
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameter: userId');
  }
  try {
    // Fetch all votes for this user from Users/{userId}/Votes
    const votesRef = db.collection('Users').doc(userId).collection('Votes');
    const snapshot = await votesRef.orderBy('timestamp', 'desc').get();
    const votes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { votes };
  } catch (err) {
    console.error('[getUserVoteHistory] Error:', err);
    throw new functions.https.HttpsError('internal', 'Failed to fetch user vote history.');
  }
});

module.exports = getUserVoteHistory;
