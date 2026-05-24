// Generate a VAPID key pair for Web Push — zero dependencies (Node crypto only).
//
//   npm run vapid
//
// Then:
//   • VAPID_PUBLIC_KEY   → Vercel env (server) AND as VITE_VAPID_PUBLIC_KEY (client, .env.local + Vercel)
//   • VAPID_PRIVATE_KEY  → Vercel env ONLY. Never commit it, never expose to the browser.
//   • VAPID_SUBJECT      → set to "mailto:you@example.com" in Vercel env.
//
// Re-running generates NEW keys; if you rotate them, every existing push
// subscription is invalidated and devices must re-enable notifications.
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });

// VAPID public key = 0x04 || X || Y (65-byte uncompressed point), base64url.
const x = Buffer.from(pub.x, 'base64url');
const y = Buffer.from(pub.y, 'base64url');
const publicKeyVapid = Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url');
// VAPID private key = the 32-byte EC private scalar, base64url (jwk.d already is).
const privateKeyVapid = priv.d;

console.log('\nVAPID keys generated. Store these as described in scripts/gen-vapid.mjs.\n');
console.log('VAPID_PUBLIC_KEY  =', publicKeyVapid);
console.log('VAPID_PRIVATE_KEY =', privateKeyVapid);
console.log('\n(VITE_VAPID_PUBLIC_KEY is the same value as VAPID_PUBLIC_KEY.)\n');
