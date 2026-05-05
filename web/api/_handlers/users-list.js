/* RESTO — /api/users
   GET  → solo owner. Lista todos los usuarios del restaurante (sin pinHash).
   POST → solo owner. Crea un usuario nuevo.
          Body: { name, role, pin, localeIds }
          Valida que el PIN no esté en uso. */

import '../_lib/loadEnv.js';
import bcrypt from 'bcryptjs';
import { getDb } from '../_lib/firebaseAdmin.js';
import { requireSession } from '../_lib/requireSession.js';

const VALID_ROLES = ['owner', 'manager', 'cashier', 'waiter', 'cook', 'bar'];
const BCRYPT_COST = 12;

function sanitizeUser(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    role: data.role,
    localeIds: data.localeIds || [],
    active: data.active !== false
  };
}

async function pinIsTaken(usersCollection, pin, ignoreUserId = null) {
  const snap = await usersCollection.get();
  for (const doc of snap.docs) {
    if (ignoreUserId && doc.id === ignoreUserId) continue;
    const data = doc.data();
    if (!data.pinHash) continue;
    const match = await bcrypt.compare(pin, data.pinHash);
    if (match) return true;
  }
  return false;
}

export default async function handler(req, res) {
  const session = await requireSession(req, res, { role: 'owner' });
  if (!session) return;

  const db = getDb();
  const usersRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('users');

  if (req.method === 'GET') {
    try {
      const snap = await usersRef.get();
      const users = snap.docs.map(sanitizeUser);
      return res.status(200).json({ users });
    } catch (error) {
      console.error('Error en GET /api/users:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { name, role, pin, localeIds } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'El PIN debe ser de 4 dígitos.' });
    }
    if (!Array.isArray(localeIds) || localeIds.length === 0) {
      return res.status(400).json({ error: 'Asigna al menos un local.' });
    }

    try {
      if (await pinIsTaken(usersRef, pin)) {
        return res.status(409).json({ error: 'Este PIN ya está en uso por otro usuario.' });
      }

      const pinHash = await bcrypt.hash(pin, BCRYPT_COST);
      const docRef = await usersRef.add({
        name: name.trim(),
        role,
        localeIds,
        pinHash,
        active: true,
        createdAt: Date.now()
      });
      const created = await docRef.get();
      return res.status(201).json(sanitizeUser(created));
    } catch (error) {
      console.error('Error en POST /api/users:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
