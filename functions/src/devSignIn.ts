import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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
export const devSignIn = functions.https.onRequest(async (req, res) => {
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
  } catch (err: any) {
    console.error('devSignIn error', err);
    res.status(500).json({ error: 'internal' });
  }
});
