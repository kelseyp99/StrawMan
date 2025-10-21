// addCandidates.js
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function addCandidates() {
  const electionId = '3000';
  const candidates = [
    { name: 'Eve Leader', votes: 12, electionId },
    { name: 'Frank Runner', votes: 8, electionId },
    { name: 'Grace Law', votes: 5, electionId },
    { name: 'Henry Policy', votes: 3, electionId }
  ];

  for (const candidate of candidates) {
    const ref = db.collection('Candidates').doc();
    await ref.set(candidate);
    console.log('Added candidate:', candidate.name);
  }
  console.log('All candidates added for electionId', electionId);
}

addCandidates().catch(console.error);