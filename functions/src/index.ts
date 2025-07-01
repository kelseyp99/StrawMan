/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

const UID = 'qDgUmVxu2XWmCMwGjSgm0vIEZVR2';

export const migrateLegacyDiscussions = onRequest(async (req, res) => {
  const db = admin.firestore();
  const legacySnap = await db.collection('Discussion').get();

  let migrated = 0;
  for (const doc of legacySnap.docs) {
    const data = doc.data();
    const ri = data.timestamp;
    if (!ri) continue; // skip if no timestamp

    // Check if the row already exists in the user-scoped collection
    const targetDocRef = db
      .collection(`Users/${UID}/Discussion`)
      .doc(String(ri));
    const targetDoc = await targetDocRef.get();

    let operation: 'create' | 'update' | 'delete' = 'create';
    if (targetDoc.exists) {
      operation = 'update';
    }
    if (data.deleted) {
      operation = 'delete';
      // Actually delete the doc if it exists
      if (targetDoc.exists) {
        await targetDocRef.delete();
      }
    } else {
      await targetDocRef.set(data, { merge: true });
    }

    // Always create or update the changelog entry, even for deletes
    await db.collection(`Users/${UID}/ChangeLog`).doc(String(ri)).set({
      tableName: 'Discussion',
      ri,
      operation,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: 'cloud-migration',
      data,
    });

    migrated++;
  }

  res.send(`Migrated ${migrated} legacy discussions with change log entries.`);
});

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
