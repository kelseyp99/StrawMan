"use strict";
// Firebase Functions (ESM, TypeScript) for Civic API Proxy
// File: functions/src/index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUserTransactions = exports.redeemPoints = exports.creditPoints = exports.getUserBallot = exports.saveUserAddress = exports.ballot = exports.elections = void 0;
const https_1 = require("firebase-functions/v2/https");
const functions = __importStar(require("firebase-functions"));
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const node_fetch_1 = __importDefault(require("node-fetch"));
admin.initializeApp();
const db = admin.firestore();
const cors = (0, cors_1.default)({ origin: true });
// ENV: Retrieve Civic API key from environment variables (v2 functions)
function getCivicApiKey() {
    return process.env.CIVIC_API_KEY || "";
}
// --- Helpers ---
async function fetchJson(url) {
    const res = await (0, node_fetch_1.default)(url, { method: "GET" });
    if (!res.ok)
        throw new Error(`Upstream error ${res.status}`);
    return await res.json();
}
function qs(params) {
    return Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
}
function cacheKey(kind, params) {
    const body = JSON.stringify(params, Object.keys(params).sort());
    return `${kind}:${Buffer.from(body).toString("base64url")}`;
}
async function getCached(key) {
    const doc = await db.collection("civic_cache").doc(key).get();
    if (!doc.exists)
        return null;
    const data = doc.data();
    if (!data?.expiresAt || typeof data.expiresAt.toMillis !== 'function' || data.expiresAt.toMillis() < Date.now())
        return null;
    return data?.payload;
}
async function setCached(key, payload, ttlSeconds) {
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + ttlSeconds * 1000);
    await db.collection("civic_cache").doc(key).set({ payload, expiresAt }, { merge: true });
}
function ensureParam(value, name) {
    if (!value || !value.trim())
        throw new Error(`Missing required param: ${name}`);
    return value.trim();
}
function normalizeElections(api) {
    const list = Array.isArray(api?.elections) ? api.elections : [];
    return list.map((e) => ({
        id: String(e.id),
        name: e.name ?? "",
        electionDay: e.electionDay ?? "",
        ocdDivisionId: e.ocdDivisionId,
    }));
}
function normalizeContests(api) {
    const raw = Array.isArray(api?.contests) ? api.contests : [];
    return raw.map((c) => {
        const candidates = Array.isArray(c?.candidates) ? c.candidates : [];
        const normalizedCandidates = candidates.map((cand) => ({
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
exports.elections = (0, https_1.onRequest)(async (req, res) => {
    cors(req, res, async () => {
        try {
            if (req.method !== "GET")
                return res.status(405).send("Method Not Allowed");
            const country = req.query.country ?? "us";
            const key = cacheKey("elections", { country });
            const cached = await getCached(key);
            if (cached)
                return res.status(200).json(cached);
            const url = `https://civicinfo.googleapis.com/civicinfo/v2/elections?${qs({ key: getCivicApiKey() })}`;
            // Fetch and handle non-200 responses gracefully
            const response = await (0, node_fetch_1.default)(url);
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
            const payload = { elections };
            await setCached(key, payload, 60 * 60 * 24); // 24h
            return res.status(200).json(payload);
        }
        catch (err) {
            logger.error("elections error", { err: err?.message });
            return res.status(500).json({ error: "Failed to fetch elections" });
        }
    });
});
// --- /civic/ballot ---
exports.ballot = (0, https_1.onRequest)({
    secrets: [],
    // Load environment variables from .env file
}, (req, res) => {
    cors(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        try {
            if (req.method !== "GET")
                return res.status(405).send("Method Not Allowed");
            const address = ensureParam(req.query.address, "address");
            const electionId = ensureParam(req.query.electionId, "electionId");
            const key = cacheKey("ballot", { address, electionId });
            const cached = await getCached(key);
            if (cached)
                return res.status(200).json(cached);
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
            const response = await (0, node_fetch_1.default)(url);
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
            const payload = { electionId, address, contests };
            await setCached(key, payload, 60 * 60 * 6); // 6h
            return res.status(200).json(payload);
        }
        catch (err) {
            const msg = err?.message ?? "Unknown error";
            logger.error("ballot error", { msg });
            const isParam = msg.startsWith("Missing required param");
            return res.status(isParam ? 400 : 500).json({ error: msg });
        }
    });
});
// --- /saveUserAddress ---
// Saves user address, fetches ballot data, stores ballot if new, updates user profile
exports.saveUserAddress = (0, https_1.onRequest)({
    secrets: [],
}, (req, res) => {
    cors(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        try {
            if (req.method !== "POST")
                return res.status(405).send("Method Not Allowed");
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
            const response = await (0, node_fetch_1.default)(url);
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
            }
            else {
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
        }
        catch (err) {
            logger.error("saveUserAddress error", { error: err?.message });
            return res.status(500).json({ error: err?.message || "Failed to save address" });
        }
    });
});
// --- /getUserBallot ---
// Retrieves ballot data for a user based on their electionId
exports.getUserBallot = (0, https_1.onRequest)({
    secrets: [],
}, (req, res) => {
    cors(req, res, async () => {
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        try {
            if (req.method !== "GET")
                return res.status(405).send("Method Not Allowed");
            const userId = req.query.userId;
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
        }
        catch (err) {
            logger.error("getUserBallot error", { error: err?.message });
            return res.status(500).json({ error: err?.message || "Failed to get user ballot" });
        }
    });
});
// --- creditPoints (callable) ---
// Usage: callable function from client to credit points to the authenticated user
exports.creditPoints = functions.https.onCall(async (data, context) => {
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
    }
    catch (err) {
        logger.error('creditPoints error', { err: err?.message });
        throw new functions.https.HttpsError('internal', 'Failed to credit points');
    }
});
// --- redeemPoints (callable) ---
// Allows a user to redeem points for a virtual reward. Records a redemption tx.
exports.redeemPoints = functions.https.onCall(async (data, context) => {
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
    }
    catch (err) {
        logger.error('redeemPoints error', { err: err?.message });
        if (err instanceof functions.https.HttpsError)
            throw err;
        throw new functions.https.HttpsError('internal', 'Failed to redeem points');
    }
});
// --- listUserTransactions (callable) ---
// Admin-only: list recent wallet transactions for a user
exports.listUserTransactions = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token || !context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Requires admin privileges');
    }
    const uid = String(data?.uid || '');
    if (!uid)
        throw new functions.https.HttpsError('invalid-argument', 'Missing uid');
    try {
        const q = db.collection('users').doc(uid).collection('wallet').orderBy('createdAt', 'desc').limit(100);
        const snaps = await q.get();
        const items = [];
        snaps.forEach(s => items.push({ id: s.id, ...(s.data() || {}) }));
        return { success: true, transactions: items };
    }
    catch (err) {
        logger.error('listUserTransactions error', { err: err?.message });
        throw new functions.https.HttpsError('internal', 'Failed to list transactions');
    }
});
