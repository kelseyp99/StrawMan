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
exports.redeemGift = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
admin.initializeApp();
const db = admin.firestore();
// Mock gift provider call
async function issueGiftCertificate(userEmail, amount) {
    // In production, call the real provider API here.
    return {
        providerId: 'MOCK-GIFT-1',
        code: `GIFT-${Date.now()}`,
        amount,
        issuedAt: new Date().toISOString(),
    };
}
exports.redeemGift = (0, https_1.onRequest)(async (req, res) => {
    try {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        const { email, points, sku } = req.body;
        if (!email) {
            res.status(400).json({ error: 'email required' });
            return;
        }
        // simple mock: 100 points = $1
        const dollars = Math.floor(points / 100);
        if (dollars <= 0) {
            res.status(400).json({ error: 'not enough points' });
            return;
        }
        // issue with mock provider
        const gift = await issueGiftCertificate(email, dollars);
        // record redemption
        await db.collection('redemptions').add({
            email,
            points,
            sku: sku || 'DEFAULT',
            gift,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ ok: true, gift });
        return;
    }
    catch (e) {
        logger.error('redeemGift error', e);
        res.status(500).json({ error: 'internal' });
        return;
    }
});
