/* RESTO — /api/tables/:id
   PATCH { localeId, ... } → solo owner. Edita mesa.
   DELETE ?localeId=X       → solo owner. Elimina mesa (no permitido si tiene
                              orden activa). */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

function sanitize(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    number: data.number,
    x: typeof data.x === 'number' ? data.x : 0,
    y: typeof data.y === 'number' ? data.y : 0,
    capacity: typeof data.capacity === 'number' ? data.capacity : 4,
    shape: data.shape || 'square',
    active: data.active !== false,
    activeOrderId: data.activeOrderId || null,
    openedAt: data.openedAt || null
  };
}

export default async function handler(req, res) {
  const session = await requireSession(req, res, { role: 'owner' });
  if (!session) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const db = getDb();
  const ref = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId)
    .collection('tables').doc(id);

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const update = {};

    if (typeof body.number === 'string' && body.number.trim()) {
      update.number = body.number.trim();
    }
    if (typeof body.x === 'number') update.x = Math.max(0, Math.round(body.x));
    if (typeof body.y === 'number') update.y = Math.max(0, Math.round(body.y));
    if (typeof body.capacity === 'number' && body.capacity > 0) {
      update.capacity = body.capacity;
    }
    if (typeof body.active === 'boolean') update.active = body.active;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Sin cambios válidos' });
    }

    try {
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
      }
      await ref.update(update);
      const updated = await ref.get();
      return res.status(200).json(sanitize(updated));
    } catch (error) {
      console.error('Error en PATCH /api/tables/[id]:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
      }
      if (snap.data().activeOrderId) {
        return res.status(400).json({
          error: 'No se puede eliminar una mesa con una orden activa.'
        });
      }
      await ref.delete();
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error en DELETE /api/tables/[id]:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
