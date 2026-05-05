/* RESTO — /api/users/:id
   PATCH → solo owner. Edita name, role, pin (rehashea), localeIds, active.

   Reglas que el server impone:
     - El owner NO puede cambiar su propio rol (bloquearía el sistema).
     - El owner NO puede desactivarse a sí mismo.
     - Si el cambio dejaría 0 owners activos, se rechaza.
     - PIN nuevo se valida contra colisiones (excluyendo el doc actual). */

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

async function countActiveOwners(usersRef, excludeUserId = null) {
  const snap = await usersRef.where('role', '==', 'owner').where('active', '==', true).get();
  let count = 0;
  for (const d of snap.docs) {
    if (excludeUserId && d.id === excludeUserId) continue;
    count += 1;
  }
  return count;
}

async function pinIsTaken(usersRef, pin, ignoreUserId) {
  const snap = await usersRef.get();
  for (const doc of snap.docs) {
    if (doc.id === ignoreUserId) continue;
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

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const db = getDb();
  const usersRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('users');
  const ref = usersRef.doc(id);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const current = snap.data();
    const body = req.body || {};
    const update = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim();
    }

    if (typeof body.role === 'string') {
      if (!VALID_ROLES.includes(body.role)) {
        return res.status(400).json({ error: 'Rol inválido.' });
      }
      if (id === session.userId && body.role !== current.role) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
      }
      if (current.role === 'owner' && body.role !== 'owner') {
        const remaining = await countActiveOwners(usersRef, id);
        if (remaining < 1) {
          return res.status(400).json({ error: 'Debe quedar al menos un propietario activo.' });
        }
      }
      update.role = body.role;
    }

    if (Array.isArray(body.localeIds)) {
      if (body.localeIds.length === 0) {
        return res.status(400).json({ error: 'Debe quedar al menos un local asignado.' });
      }
      update.localeIds = body.localeIds;
    }

    if (typeof body.active === 'boolean') {
      if (id === session.userId && body.active === false) {
        return res.status(400).json({ error: 'No puedes desactivarte a ti mismo.' });
      }
      if (current.role === 'owner' && current.active !== false && body.active === false) {
        const remaining = await countActiveOwners(usersRef, id);
        if (remaining < 1) {
          return res.status(400).json({ error: 'Debe quedar al menos un propietario activo.' });
        }
      }
      update.active = body.active;
    }

    if (typeof body.pin === 'string') {
      if (!/^\d{4}$/.test(body.pin)) {
        return res.status(400).json({ error: 'El PIN debe ser de 4 dígitos.' });
      }
      if (await pinIsTaken(usersRef, body.pin, id)) {
        return res.status(409).json({ error: 'Este PIN ya está en uso por otro usuario.' });
      }
      update.pinHash = await bcrypt.hash(body.pin, BCRYPT_COST);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Sin cambios válidos' });
    }

    await ref.update(update);
    const updated = await ref.get();
    return res.status(200).json(sanitizeUser(updated));
  } catch (error) {
    console.error('Error en PATCH /api/users/[id]:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
