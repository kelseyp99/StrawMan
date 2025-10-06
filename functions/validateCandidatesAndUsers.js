// validateCandidatesAndUsers.js
// Script to validate Firestore structure for voting system
// Usage: node validateCandidatesAndUsers.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function validateCandidates() {
  const snapshot = await db.collection('candidates').get();
  let missing = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const electionId = data.elections_FK || data.elections_fk;
    if (!electionId) {
      missing.push(doc.id);
    }
  });
  if (missing.length) {
    console.log('Candidates missing elections_FK:', missing);
  } else {
    console.log('All candidates have elections_FK.');
  }
}

async function validateUsers() {
  const snapshot = await db.collection('users').get();
  let issues = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.elections && typeof data.elections === 'object') {
      Object.keys(data.elections).forEach(electionId => {
        const record = data.elections[electionId];
        if (!record.hasVoted || !record.selectedId) {
          issues.push({ userId: doc.id, electionId });
        }
      });
    }
  });
  if (issues.length) {
    console.log('User voting records with missing fields:', issues);
  } else {
    console.log('All user voting records are valid.');
  }
}

(async () => {
  await validateCandidates();
  await validateUsers();
  process.exit();
})();
