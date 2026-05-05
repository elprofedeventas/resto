/* RESTO — /api/locales/:id
   PATCH → solo owner. Actualiza name, address, phone, active. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { requireSession } from '../_lib/requireSession.js';

export default async function handler(req, res) {
  const session = await requireSession(req, res, { role: 'owner' });
  if (!session) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const db = getDb();
  const ref = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(id);

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const update = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim();
    }
    if (typeof body.address === 'string') update.address = body.address.trim();
    if (typeof body.phone === 'string') update.phone = body.phone.trim();
    if (typeof body.active === 'boolean') update.active = body.active;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Sin cambios válidos' });
    }

    try {
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Local no encontrado' });
      }
      await ref.update(update);
      const updated = await ref.get();
      return res.status(200).json({ id: updated.id, ...updated.data() });
    } catch (error) {
      console.error('Error en PATCH /api/locales/[id]:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
