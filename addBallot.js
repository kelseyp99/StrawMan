// addBallot.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();


async function addDocs() {
  const projectId = admin.app().options.projectId;
  console.log('Using Firebase project:', projectId);

  // Add user document
  const userRef = db.collection('users').doc('werkhardor@gmail.com');
  await userRef.set({
    email: 'werkhardor@gmail.com',
    electionId: '2000',
    name: 'Werk Hardor'
  });
  console.log("User document added!");

  // Add ballot document for electionId '2000'
  const ballotRef2000 = db.collection('civic_cache').doc('2000');
  await ballotRef2000.set({
    electionId: "2000",
    contests: [
      {
        id: "mayor",
        office: "Mayor",
        candidates: [
          { name: "Alice Example" },
          { name: "Bob Sample" }
        ]
      },
      {
        id: "council",
        office: "City Council",
        candidates: [
          { name: "Carol Demo" },
          { name: "Dan Test" }
        ]
      }
    ]
  });
  console.log("Ballot document for electionId 2000 added!");

  // Add ballot document for electionId '3000'
  const ballotRef3000 = db.collection('civic_cache').doc('3000');
  await ballotRef3000.set({
    electionId: "3000",
    contests: [
      {
        id: "president",
        office: "President",
        candidates: [
          { name: "Eve Leader" },
          { name: "Frank Runner" }
        ]
      },
      {
        id: "senate",
        office: "Senate",
        candidates: [
          { name: "Grace Law" },
          { name: "Henry Policy" }
        ]
      }
    ]
  });
  console.log("Ballot document for electionId 3000 added!");
}

addDocs().catch(console.error);
