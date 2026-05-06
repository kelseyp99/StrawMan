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
exports.devSignIn = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize admin SDK (in production cloud functions this will use the service account)
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Dev-only HTTP function to mint a Firebase custom token for a given uid.
 * Usage: POST { secret: string, uid?: string }
 * Protect this by setting the DEV_SIGNIN_SECRET env var in your functions environment.
 * IMPORTANT: This must NOT be deployed to production without rotating/removing the secret.
 */
exports.devSignIn = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    const secret = req.body && req.body.secret;
    if (!secret || secret !== process.env.DEV_SIGNIN_SECRET) {
        res.status(403).json({ error: 'forbidden' });
        return;
    }
    const uid = (req.body && req.body.uid) || ('dev:' + (req.body && req.body.email ? req.body.email : 'dev_user'));
    try {
        const customToken = await admin.auth().createCustomToken(uid);
        res.json({ customToken });
    }
    catch (err) {
        console.error('devSignIn error', err);
        res.status(500).json({ error: 'internal' });
    }
});
