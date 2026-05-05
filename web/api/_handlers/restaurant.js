/* RESTO — /api/restaurant
   GET   → todos los roles logueados pueden leer
   PATCH → solo owner puede actualizar nombre, currency, timezone y settings */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { requireSession } from '../_lib/requireSession.js';

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const db = getDb();
  const ref = db.collection('restaurants').doc(session.restaurantId);

  if (req.method === 'GET') {
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Restaurante no encontrado' });
    }
    return res.status(200).json({ id: snap.id, ...snap.data() });
  }

  if (req.method === 'PATCH') {
    if (session.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const body = req.body || {};
    const update = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim();
    }
    if (typeof body.currency === 'string' && body.currency.length >= 3) {
      update.currency = body.currency;
    }
    if (typeof body.timezone === 'string' && body.timezone.length > 0) {
      update.timezone = body.timezone;
    }
    if (body.settings && typeof body.settings === 'object') {
      if (typeof body.settings.targetMargin === 'number') {
        const m = body.settings.targetMargin;
        if (m >= 0 && m <= 1) update['settings.targetMargin'] = m;
      }
      if (typeof body.settings.pricePerLocaleEnabled === 'boolean') {
        update['settings.pricePerLocaleEnabled'] = body.settings.pricePerLocaleEnabled;
      }
      if (typeof body.settings.monthlyPayroll === 'number' && body.settings.monthlyPayroll >= 0) {
        update['settings.monthlyPayroll'] = body.settings.monthlyPayroll;
      }
      if (
        typeof body.settings.monthlyFixedExpenses === 'number' &&
        body.settings.monthlyFixedExpenses >= 0
      ) {
        update['settings.monthlyFixedExpenses'] = body.settings.monthlyFixedExpenses;
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Sin cambios válidos' });
    }

    try {
      await ref.update(update);
      const snap = await ref.get();
      return res.status(200).json({ id: snap.id, ...snap.data() });
    } catch (error) {
      console.error('Error en PATCH /api/restaurant:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
