import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

admin.initializeApp();
const db = admin.firestore();

// Mock gift provider call
async function issueGiftCertificate(userEmail: string, amount: number) {
  // In production, call the real provider API here.
  return {
    providerId: 'MOCK-GIFT-1',
    code: `GIFT-${Date.now()}`,
    amount,
    issuedAt: new Date().toISOString(),
  };
}

export const redeemGift = onRequest(async (req, res) => {
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
  } catch (e) {
    logger.error('redeemGift error', e);
    res.status(500).json({ error: 'internal' });
    return;
  }
});
