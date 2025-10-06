// addCandidate.js
// Usage: node addCandidate.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addCandidate() {
  await db.collection('candidates').doc('ham').set({
    name: 'Ham San Which',
    elections_FK: 'fl_gov_1757247249603',
    voteTally: 0
  });
  console.log('Candidate ham added.');
  process.exit();
}

addCandidate();
