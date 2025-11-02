// Firebase Functions (ESM, TypeScript) for Civic API Proxy
// File: functions/src/index.ts

import { onRequest } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import corsLib from "cors";
import fetch from "node-fetch";

admin.initializeApp();
const db = admin.firestore();
const cors = corsLib({ origin: true });

// ENV: Retrieve Civic API key from environment variables (v2 functions)
function getCivicApiKey() {
  return process.env.CIVIC_API_KEY || "";
}

// --- Types ---
type NormalizedElection = {
  id: string;
  name: string;
  electionDay: string;
  ocdDivisionId?: string;
};
type NormalizedCandidate = {
  name: string;
  party?: string;
  candidateUrl?: string;
  photoUrl?: string;
};
type NormalizedContest = {
  id: string;
  office: string;
  type?: string;
  district?: { name?: string; scope?: string };
  candidates: NormalizedCandidate[];
};
type ElectionsResponse = { elections: NormalizedElection[] };
type BallotResponse = {
  electionId: string;
  address: string;
  contests: NormalizedContest[];
};

// --- Helpers ---
async function fetchJson(url: string) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Upstream error ${res.status}`);
  return await res.json();
}
function qs(params: Record<string, string | number | undefined>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}
function cacheKey(kind: "elections" | "ballot", params: Record<string, unknown>) {
  const body = JSON.stringify(params, Object.keys(params).sort());
  return `${kind}:${Buffer.from(body).toString("base64url")}`;
}
async function getCached(key: string) {
  const doc = await db.collection("civic_cache").doc(key).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data?.expiresAt || typeof data.expiresAt.toMillis !== 'function' || data.expiresAt.toMillis() < Date.now()) return null;
  return data?.payload;
}
async function setCached(key: string, payload: any, ttlSeconds: number) {
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + ttlSeconds * 1000);
  await db.collection("civic_cache").doc(key).set({ payload, expiresAt }, { merge: true });
}
function ensureParam(value: string | undefined, name: string) {
  if (!value || !value.trim()) throw new Error(`Missing required param: ${name}`);
  return value.trim();
}
function normalizeElections(api: any): NormalizedElection[] {
  const list = Array.isArray(api?.elections) ? api.elections : [];
  return list.map((e: any) => ({
    id: String(e.id),
    name: e.name ?? "",
    electionDay: e.electionDay ?? "",
    ocdDivisionId: e.ocdDivisionId,
  }));
}
function normalizeContests(api: any): NormalizedContest[] {
  const raw = Array.isArray(api?.contests) ? api.contests : [];
  return raw.map((c: any) => {
    const candidates = Array.isArray(c?.candidates) ? c.candidates : [];
    const normalizedCandidates: NormalizedCandidate[] = candidates.map((cand: any) => ({
      name: cand.name ?? "",
      party: cand.party,
      candidateUrl: cand.candidateUrl,
      photoUrl: cand.photoUrl,
    }));
    const idParts = [c.office, c?.district?.name, c.type].filter(Boolean).join("|");
    return {
      id: idParts || Math.random().toString(36).slice(2),
      office: c.office ?? "",
      type: c.type,
      district: c.district ? { name: c.district.name, scope: c.district.scope } : undefined,
      candidates: normalizedCandidates,
    };
  });
}

// --- /civic/elections ---
export const elections = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "GET") return res.status(405).send("Method Not Allowed");
      const country = (req.query.country as string) ?? "us";
      const key = cacheKey("elections", { country });
      const cached = await getCached(key);
      if (cached) return res.status(200).json(cached);
  const url = `https://civicinfo.googleapis.com/civicinfo/v2/elections?${qs({ key: getCivicApiKey() })}`;
      // Fetch and handle non-200 responses gracefully
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Civic API error", { status: response.status, errorText });
        return res.status(response.status).json({
          error: `Civic API error: ${response.status} - ${response.statusText}`,
          details: errorText
        });
      }
      const api = await response.json();
      const elections = normalizeElections(api);
      const payload: ElectionsResponse = { elections };
      await setCached(key, payload, 60 * 60 * 24); // 24h
      return res.status(200).json(payload);
    } catch (err: any) {
      logger.error("elections error", { err: err?.message });
      return res.status(500).json({ error: "Failed to fetch elections" });
    }
  });
});

// --- /civic/ballot ---
export const ballot = onRequest({
  secrets: [],
  // Load environment variables from .env file
}, (req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    try {
      if (req.method !== "GET") return res.status(405).send("Method Not Allowed");
      const address = ensureParam(req.query.address as string, "address");
      const electionId = ensureParam(req.query.electionId as string, "electionId");
      const key = cacheKey("ballot", { address, electionId });
      const cached = await getCached(key);
      if (cached) return res.status(200).json(cached);
      const civicApiKey = getCivicApiKey();
      logger.info("Civic API key retrieved", { civicApiKey, isEmpty: !civicApiKey, length: civicApiKey?.length });
      
      if (!civicApiKey) {
        logger.error("No Civic API key available!");
        return res.status(500).json({ error: "Server configuration error: No Civic API key configured" });
      }
      
      const url = `https://civicinfo.googleapis.com/civicinfo/v2/voterinfo?${qs({
        address,
        electionId,
        key: civicApiKey,
      })}`;
      logger.info("Civic API request URL", { url });
      
      // Fetch and handle non-200 responses gracefully
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Civic API error", { status: response.status, errorText });
        return res.status(response.status).json({
          error: `Civic API error: ${response.status} - ${response.statusText}`,
          details: errorText
        });
      }
      const api = await response.json();
      const contests = normalizeContests(api);
      const payload: BallotResponse = { electionId, address, contests };
      await setCached(key, payload, 60 * 60 * 6); // 6h
      return res.status(200).json(payload);
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      logger.error("ballot error", { msg });
      const isParam = msg.startsWith("Missing required param");
      return res.status(isParam ? 400 : 500).json({ error: msg });
    }
  });
});

// --- /saveUserAddress ---
// Saves user address, fetches ballot data, stores ballot if new, updates user profile
export const saveUserAddress = onRequest({
  secrets: [],
}, (req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
      
      const { userId, address, electionId } = req.body;
      
      if (!userId || !address || !electionId) {
        return res.status(400).json({ error: "Missing required fields: userId, address, electionId" });
      }

      // Get user's current profile
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      // Check if address has changed
      if (userData?.address === address.trim()) {
        return res.status(200).json({ 
          message: "Address unchanged. No action needed.",
          unchanged: true 
        });
      }

      // Fetch ballot data from Google Civic API
      const civicApiKey = getCivicApiKey();
      if (!civicApiKey) {
        return res.status(500).json({ error: "Server configuration error: No Civic API key configured" });
      }

      const url = `https://civicinfo.googleapis.com/civicinfo/v2/voterinfo?${qs({
        address,
        electionId,
        key: civicApiKey,
      })}`;

      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Civic API error in saveUserAddress", { status: response.status, errorText });
        return res.status(response.status).json({
          error: `Civic API error: ${response.status}`,
          details: errorText
        });
      }

      const api = await response.json();
      const contests = normalizeContests(api);
      const normalizedAddress = api.normalizedInput ? 
        `${api.normalizedInput.line1 || ''}, ${api.normalizedInput.city || ''}, ${api.normalizedInput.state || ''} ${api.normalizedInput.zip || ''}`.trim() : 
        address;

      // Check if ballot exists in ballots collection
      const ballotRef = db.collection('ballots').doc(electionId);
      const ballotDoc = await ballotRef.get();

      if (!ballotDoc.exists) {
        // Create new ballot document
        await ballotRef.set({
          electionId,
          contests,
          sourceAddress: normalizedAddress,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Created new ballot document for electionId: ${electionId}`);

          // --- Candidate/ballot linking logic ---
          for (const contest of contests) {
            for (const candidate of contest.candidates) {
              // Normalize candidate name for search
              const normName = candidate.name.trim().toUpperCase();
              // Search for candidate by normalized name
              const q = db.collection('candidates').where('name', '==', normName).limit(1);
              const snap = await q.get();
              if (snap.empty) {
                // Create new candidate doc with ballotIds array
                await db.collection('candidates').add({
                  name: normName,
                  ballotIds: [electionId],
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  ...candidate
                });
                logger.info(`Created candidate: ${normName} for ballot ${electionId}`);
              } else {
                // Update ballotIds array if not present
                const docRef = snap.docs[0].ref;
                const data = snap.docs[0].data();
                const ballotIds = Array.isArray(data.ballotIds) ? data.ballotIds : [];
                if (!ballotIds.includes(electionId)) {
                  await docRef.update({
                    ballotIds: admin.firestore.FieldValue.arrayUnion(electionId)
                  });
                  logger.info(`Updated candidate: ${normName} with new ballot ${electionId}`);
                }
              }
            }
          }
      } else {
        logger.info(`Ballot for electionId ${electionId} already exists`);
      }

      // Update user profile
      await userRef.set({
        address: normalizedAddress,
        electionId,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return res.status(200).json({
        message: "Address saved successfully",
        electionId,
        address: normalizedAddress,
        ballotCreated: !ballotDoc.exists
      });

    } catch (err: any) {
      logger.error("saveUserAddress error", { error: err?.message });
      return res.status(500).json({ error: err?.message || "Failed to save address" });
    }
  });
});

// --- /getUserBallot ---
// Retrieves ballot data for a user based on their electionId
export const getUserBallot = onRequest({
  secrets: [],
}, (req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    try {
      if (req.method !== "GET") return res.status(405).send("Method Not Allowed");
      
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: "Missing required parameter: userId" });
      }

      // Get user profile
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      if (!userData?.electionId) {
        return res.status(404).json({ error: "User has no election assigned. Please save your address first." });
      }

      // Get ballot data
      const ballotDoc = await db.collection('ballots').doc(userData.electionId).get();
      if (!ballotDoc.exists) {
        return res.status(404).json({ error: "Ballot not found for this election" });
      }

      const ballotData = ballotDoc.data();

      return res.status(200).json({
        user: {
          address: userData.address,
          electionId: userData.electionId
        },
        ballot: {
          electionId: ballotData?.electionId,
          contests: ballotData?.contests || [],
          lastUpdated: ballotData?.lastUpdated
        }
      });

    } catch (err: any) {
      logger.error("getUserBallot error", { error: err?.message });
      return res.status(500).json({ error: err?.message || "Failed to get user ballot" });
    }
  });
});

// --- creditPoints (callable) ---
// Usage: callable function from client to credit points to the authenticated user
export const creditPoints = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const uid = context.auth.uid;
  const amount = Number(data?.amount || 0);
  const reason = String(data?.reason || 'credit');

  if (!amount || isNaN(amount) || Math.abs(amount) > 10000) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid amount');
  }

  const walletRef = db.collection('users').doc(uid).collection('wallet').doc('account');
  const txRef = db.collection('users').doc(uid).collection('wallet').doc();

  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(walletRef);
      const prev = (snap.exists && snap.data()?.balance) ? Number(snap.data()?.balance) : 0;
      const next = prev + amount;
      t.set(walletRef, { balance: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(txRef, { amount, reason, createdAt: admin.firestore.FieldValue.serverTimestamp(), type: 'credit' });
    });

    const newSnap = await walletRef.get();
    const newBalance = newSnap.exists ? Number(newSnap.data()?.balance || 0) : 0;
    return { success: true, balance: newBalance };
  } catch (err: any) {
    logger.error('creditPoints error', { err: err?.message });
    throw new functions.https.HttpsError('internal', 'Failed to credit points');
  }
});

// --- redeemPoints (callable) ---
// Allows a user to redeem points for a virtual reward. Records a redemption tx.
export const redeemPoints = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }
  const uid = context.auth.uid;
  const cost = Number(data?.cost || 0);
  const item = String(data?.item || 'redeem');

  if (!cost || isNaN(cost) || cost <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid cost');
  }

  const walletRef = db.collection('users').doc(uid).collection('wallet').doc('account');
  const txRef = db.collection('users').doc(uid).collection('wallet').doc();

  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(walletRef);
      const prev = (snap.exists && snap.data()?.balance) ? Number(snap.data()?.balance) : 0;
      if (prev < cost) {
        throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance');
      }
      const next = prev - cost;
      t.set(walletRef, { balance: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      t.set(txRef, { amount: -cost, item, createdAt: admin.firestore.FieldValue.serverTimestamp(), type: 'redeem' });
    });

    const newSnap = await walletRef.get();
    const newBalance = newSnap.exists ? Number(newSnap.data()?.balance || 0) : 0;
    return { success: true, balance: newBalance };
  } catch (err: any) {
    logger.error('redeemPoints error', { err: err?.message });
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', 'Failed to redeem points');
  }
});

// --- listUserTransactions (callable) ---
// Admin-only: list recent wallet transactions for a user
export const listUserTransactions = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Requires admin privileges');
  }
  const uid = String(data?.uid || '');
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'Missing uid');

  try {
    const q = db.collection('users').doc(uid).collection('wallet').orderBy('createdAt', 'desc').limit(100);
    const snaps = await q.get();
    const items: any[] = [];
    snaps.forEach(s => items.push({ id: s.id, ...(s.data() || {}) }));
    return { success: true, transactions: items };
  } catch (err: any) {
    logger.error('listUserTransactions error', { err: err?.message });
    throw new functions.https.HttpsError('internal', 'Failed to list transactions');
  }
});

// --- processVote (callable) ---
// Accepts: { userId, candidateId, electionId }
// User can vote multiple times. If previously voted in same election, check candidateresultshistory.
// If for same candidate, just post to user history. No candidate tally change needed.
// If voting for a different candidate, update history, decrease tally for last candidate, increase for new.
// If not voted in election, enter history and increase tally for candidate.
// Returns: { success: boolean, message: string }
export const processVote = functions.https.onCall(async (data, context) => {
  const userId = String(data?.userId || '');
  const candidateName = String(data?.candidateName || '');
  const electionId = String(data?.electionId || '');
  if (!userId || !candidateName || !electionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }
  try {
    // Normalize candidate name for search
    const normName = candidateName.trim().toUpperCase();
    // Find candidate doc with name and electionId in ballotIds
    const q = db.collection('candidates').where('name', '==', normName).where('ballotIds', 'array-contains', electionId).limit(1);
    const snap = await q.get();
    if (snap.empty) {
      throw new functions.https.HttpsError('not-found', 'Candidate not found for this election.');
    }
    const candidateDoc = snap.docs[0];
    const candidateRef = candidateDoc.ref;
    // User's vote history for this election
    const historyRef = db.collection('candidateresultshistory').doc(userId);
    const historySnap = await historyRef.get();
    let lastCandidateName = null;
    let history = [];
    if (historySnap.exists) {
      history = historySnap.data()?.[electionId] || [];
      if (history.length > 0) {
        lastCandidateName = history[history.length - 1];
      }
    }
    // If user is voting for same candidate as last time
    if (lastCandidateName === normName) {
      // Just post to user history, no tally change
      history.push(normName);
      await historyRef.set({ [electionId]: history }, { merge: true });
      return { success: true, message: 'Vote recorded (no tally change).' };
    }
    // If user is changing vote to a different candidate
    if (lastCandidateName && lastCandidateName !== normName) {
      // Decrease tally for last candidate
      const lastQ = db.collection('candidates').where('name', '==', lastCandidateName).where('ballotIds', 'array-contains', electionId).limit(1);
      const lastSnap = await lastQ.get();
      if (!lastSnap.empty) {
        await lastSnap.docs[0].ref.update({ tally: admin.firestore.FieldValue.increment(-1) });
      }
      // Increase tally for new candidate
      await candidateRef.update({ tally: admin.firestore.FieldValue.increment(1) });
      // Update history
      history.push(normName);
      await historyRef.set({ [electionId]: history }, { merge: true });
      return { success: true, message: 'Vote changed and tallies updated.' };
    }
    // If user has not voted in this election
    if (!lastCandidateName) {
      // Increase tally for candidate
      await candidateRef.update({ tally: admin.firestore.FieldValue.increment(1) });
      // Enter history
      history = [normName];
      await historyRef.set({ [electionId]: history }, { merge: true });
      return { success: true, message: 'First vote recorded and tally updated.' };
    }
    return { success: false, message: 'Unknown voting state.' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('internal', errorMsg);
  }
});
