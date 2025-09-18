import { getFirestore, setDoc, doc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebaseConfig';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Example user and election data
const userId = 'YOUR_USER_ID'; // Replace with actual user UID
const elections = [
  {
    id: 'fl_gov_20250907',
    name: 'Florida Gubernatorial',
    date: new Date(),
    description: 'Florida Gubernatorial Election',
    hasVoted: false,
  },
  // Add more elections as needed
];

async function recreateUserElections() {
  for (const election of elections) {
    await setDoc(doc(db, `Users/${userId}/Elections`, election.id), election, { merge: true });
    console.log(`Created Users/${userId}/Elections/${election.id}`);
  }
}

recreateUserElections().catch(console.error);
