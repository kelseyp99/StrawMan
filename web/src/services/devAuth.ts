import { auth } from '../firebase';
import { signInWithCustomToken } from 'firebase/auth';

export async function devSignIn(url: string, secret: string, uid?: string) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, uid })
  });
  if (!resp.ok) throw new Error('devSignIn failed: ' + resp.status);
  const json = await resp.json();
  if (!json.customToken) throw new Error('no token returned');
  return signInWithCustomToken(auth, json.customToken);
}
