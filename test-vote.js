const admin = require('firebase-admin');
const sa = require('./secrets/strawman-42-firebase-adminsdk-fbsvc-923d1212cc.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function test() {
  const candidateName = 'ALEXANDER GAASERUD';
  const electionId = '9440';
  const userId = 'test-user-123';

  console.log('Searching for:', candidateName, 'election:', electionId);
  const snap = await db.collection('candidates')
    .where('name', '==', candidateName)
    .where('electionId', '==', electionId)
    .limit(1).get();

  console.log('Found:', snap.size, 'docs');
  if (snap.empty) {
    console.log('NOT FOUND - checking all docs in election...');
    const all = await db.collection('candidates').where('electionId', '==', electionId).limit(3).get();
    all.docs.forEach(d => console.log(' -', d.data().name, '|', d.data().electionId));
    return;
  }

  console.log('Doc:', snap.docs[0].id, snap.docs[0].data().name);
  await snap.docs[0].ref.set({ tally: admin.firestore.FieldValue.increment(1) }, { merge: true });
  console.log('SUCCESS - tally incremented');

  const historyRef = db.collection('candidateresultshistory').doc(userId);
  await historyRef.set({ [electionId]: [candidateName] }, { merge: true });
  console.log('History saved');
}

test().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e.message, e.code); process.exit(1); });
