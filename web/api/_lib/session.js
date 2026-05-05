/* RESTO — manejo de sesiones server-side.

   Modelo:
     - El token se genera con crypto.randomBytes(32) → 64 chars hex.
     - El token nunca se guarda en Firestore: se guarda solo su hash sha256.
     - El cliente conserva el token en memoria y lo envía en
       `Authorization: Bearer <token>` en cada request a /api/*.
     - TTL: 12 horas (un servicio típico de restaurante). Las sesiones
       expiradas se eliminan al primer acceso fallido. */

import crypto from 'node:crypto';
import { getDb } from './firebaseAdmin.js';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(payload) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = Date.now();

  const db = getDb();
  await db.collection('sessions').doc(tokenHash).set({
    ...payload,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS
  });

  return token;
}

export async function getSession(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const db = getDb();
  const ref = db.collection('sessions').doc(tokenHash);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.expiresAt < Date.now()) {
    await ref.delete();
    return null;
  }
  return { tokenHash, ...data };
}

export async function deleteSession(token) {
  if (!token) return;
  const tokenHash = hashToken(token);
  const db = getDb();
  await db.collection('sessions').doc(tokenHash).delete();
}

export function getTokenFromRequest(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}
