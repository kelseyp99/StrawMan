"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVote = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
if (!admin.apps.length)
    admin.initializeApp();
exports.processVote = (0, https_1.onCall)(async (request) => {
    const { userId, candidateId, candidateName, electionId } = request.data;
    if (!userId || !electionId || (!candidateId && !candidateName)) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields: userId, electionId, candidateId');
    }
    const db = admin.firestore();
    const candidateKey = candidateId || candidateName;
    try {
        // Check if user has voted in this election before
        const historyRef = db.collection(`users/${userId}/voteHistory`);
        const existing = await historyRef.where('electionId', '==', electionId).orderBy('timestamp', 'desc').limit(1).get();
        const now = admin.firestore.FieldValue.serverTimestamp();
        const candidateTallyRef = db.collection('candidateResults').doc(`${electionId}_${candidateKey}`);
        if (!existing.empty) {
            const lastVote = existing.docs[0].data();
            const lastCandidateKey = lastVote.candidateId || lastVote.candidateName;
            if (lastCandidateKey === candidateKey) {
                // Same candidate — just log, no tally change
                await historyRef.add({ userId, candidateId: candidateKey, candidateName, electionId, timestamp: now, action: 'reaffirmed' });
                return { success: true, message: '✅ Vote reaffirmed (same candidate)' };
            }
            else {
                // Different candidate — switch vote
                const lastTallyRef = db.collection('candidateResults').doc(`${electionId}_${lastCandidateKey}`);
                await db.runTransaction(async (tx) => {
                    const lastSnap = await tx.get(lastTallyRef);
                    const newSnap = await tx.get(candidateTallyRef);
                    tx.set(lastTallyRef, { votes: Math.max(0, (lastSnap.data()?.votes || 1) - 1) }, { merge: true });
                    tx.set(candidateTallyRef, { votes: (newSnap.data()?.votes || 0) + 1, candidateId: candidateKey, candidateName, electionId }, { merge: true });
                });
                await historyRef.add({ userId, candidateId: candidateKey, candidateName, electionId, timestamp: now, action: 'switched', previousCandidateId: lastCandidateKey });
                return { success: true, message: '✅ Vote switched successfully' };
            }
        }
        else {
            // First vote in this election
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(candidateTallyRef);
                tx.set(candidateTallyRef, { votes: (snap.data()?.votes || 0) + 1, candidateId: candidateKey, candidateName, electionId }, { merge: true });
            });
            await historyRef.add({ userId, candidateId: candidateKey, candidateName, electionId, timestamp: now, action: 'voted' });
            return { success: true, message: '✅ Vote recorded!' };
        }
    }
    catch (err) {
        console.error('[processVote] error:', err);
        throw new https_1.HttpsError('internal', err?.message || 'Vote processing failed');
    }
});
