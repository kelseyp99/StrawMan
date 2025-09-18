/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

admin.initializeApp();

const UID = 'qDgUmVxu2XWmCMwGjSgm0vIEZVR2';

export const migrateLegacyDiscussions = onSchedule({
  schedule: '0 0 * * *', // every day at midnight UTC
  timeZone: 'America/New_York', // change to your preferred timezone
}, async (event) => {
  const db = admin.firestore();
  let migrated = 0;
  try {
    // 1. Migrate from root /Discussion
    const legacySnap = await db.collection('Discussion').get();
    for (const doc of legacySnap.docs) {
      const data = doc.data();
      const ri = data.timestamp;
      if (!ri) {
        console.warn(`[MIGRATE] Skipping doc ${doc.id} (no timestamp)`);
        continue;
      }
      try {
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
          if (targetDoc.exists) {
            await targetDocRef.delete();
            console.log(`[MIGRATE] Deleted doc for ri=${ri}`);
          }
        } else {
          await targetDocRef.set(data, { merge: true });
          console.log(`[MIGRATE] Set doc for ri=${ri}`);
        }
        await db.collection(`Users/${UID}/ChangeLog`).doc(String(ri)).set({
          tableName: 'Discussion',
          ri,
          operation,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          source: 'cloud-migration',
          data,
        });
        migrated++;
      } catch (err) {
        console.error(`[MIGRATE] Error migrating doc ${doc.id}:`, err);
      }
    }

    // 2. Migrate from /Users/{UID}/Discussions (note plural)
    const discussionsSnap = await db.collection(`Users/${UID}/Discussions`).get();
    for (const doc of discussionsSnap.docs) {
      const data = doc.data();
      // Use doc.id as the key for the new collection
      const ri = doc.id;
      try {
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
          if (targetDoc.exists) {
            await targetDocRef.delete();
            console.log(`[MIGRATE] Deleted doc for ri=${ri} (from /Discussions)`);
          }
        } else {
          await targetDocRef.set(data, { merge: true });
          console.log(`[MIGRATE] Set doc for ri=${ri} (from /Discussions)`);
        }
        await db.collection(`Users/${UID}/ChangeLog`).doc(String(ri)).set({
          tableName: 'Discussion',
          ri,
          operation,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          source: 'cloud-migration-Discussions',
          data,
        });
        migrated++;
      } catch (err) {
        console.error(`[MIGRATE] Error migrating doc ${doc.id} from /Discussions:`, err);
      }
    }

    console.log(`Migrated ${migrated} legacy discussions (including /Discussions) with change log entries.`);
  } catch (err) {
    console.error('[MIGRATE] Migration failed:', err);
  }
});

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
