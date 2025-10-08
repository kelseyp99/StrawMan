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
exports.ballot = exports.elections = void 0;
const https_1 = require("firebase-functions/v2/https");
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
