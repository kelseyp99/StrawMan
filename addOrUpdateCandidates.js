// addOrUpdateCandidates.js
// Usage: node addOrUpdateCandidates.js
// This script processes a ballot, generates a composite candidate key, and ensures unique candidates in Firestore.

const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// Helper to generate a composite key (hash) from candidate name and electionId
function candidateKey(name, electionId) {
  // Normalize name (uppercase, trim, remove punctuation)
  const normName = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
  const keyString = `${normName}|${electionId}`;
  return crypto.createHash('sha256').update(keyString).digest('hex');
}

// Main function to process a ballot and update Candidates collection
async function processBallot(ballot) {
  const electionId = ballot.electionId;
  for (const contest of ballot.contests) {
    for (const candidate of contest.candidates) {
      const key = candidateKey(candidate.name, electionId);
      const candidateRef = db.collection('Candidates').doc(key);
      const docSnap = await candidateRef.get();
      if (docSnap.exists) {
        // Candidate already exists for this electionId, do nothing
        console.log(`Candidate exists: ${candidate.name} [${key}]`);
      } else {
        // Check for similar names in this election
        const q = db.collection('Candidates').where('electionId', '==', electionId);
        const snapshot = await q.get();
        let foundSimilar = false;
        for (const doc of snapshot.docs) {
          const existing = doc.data();
          if (nameSimilarity(existing.name, candidate.name) >= 0.8) {
            foundSimilar = true;
            // Write to Alerts collection for manual review
            await db.collection('Alerts').add({
              type: 'candidate_name_similarity',
              electionId,
              name1: existing.name,
              name2: candidate.name,
              candidateId1: doc.id,
              candidateId2: key,
              timestamp: new Date().toISOString()
            });
            console.log(`ALERT: Similar candidate names found: '${existing.name}' vs '${candidate.name}'`);
          }
        }
        if (!foundSimilar) {
          await candidateRef.set({
            name: candidate.name,
            electionId,
            contestId: contest.id,
            office: contest.office,
            votes: 0,
            createdAt: new Date(),
            compositeKey: key
          });
          console.log(`Created candidate: ${candidate.name} [${key}]`);
        }
      }
    }
  }
// Simple similarity function for names
function nameSimilarity(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 1;
  if (a.startsWith(b) || b.startsWith(a)) return 0.8;
  if (a.includes(b) || b.includes(a)) return 0.6;
  return 0;
}
}

// Example usage: process a sample ballot
async function main() {
  const ballot = {
    electionId: '3000',
    contests: [
      {
        id: 'president',
        office: 'President',
        candidates: [
          { name: 'Eve Leader' },
          { name: 'Frank Runner' }
        ]
      },
      {
        id: 'senate',
        office: 'Senate',
        candidates: [
          { name: 'Grace Law' },
          { name: 'Henry Policy' }
        ]
      }
    ]
  };
  await processBallot(ballot);
  console.log('Done.');
}

main().catch(console.error);
