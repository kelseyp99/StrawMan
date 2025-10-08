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
