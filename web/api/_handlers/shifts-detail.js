/* RESTO — /api/shifts/:id
   GET ?localeId=X → detalle de un turno (abierto o cerrado).
                     Si está abierto, recalcula totales en vivo. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';
import { computeShiftTotals } from '../_lib/shiftTotals.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const db = getDb();
  const localeRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId);
  const ref = localeRef.collection('shifts').doc(id);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    const data = snap.data();
    const result = {
      id: snap.id,
      status: data.status,
      openedAt: data.openedAt || null,
      openedById: data.openedById,
      openedByName: data.openedByName,
      openingCash: data.openingCash || 0,
      closedAt: data.closedAt || null,
      closedById: data.closedById || null,
      closedByName: data.closedByName || null,
      closingCash: data.closingCash ?? null,
      expectedCash: data.expectedCash ?? null,
      diff: data.diff ?? null,
      notes: data.notes || '',
      totals: data.totals || null
    };

    if (data.status === 'open') {
      const totals = await computeShiftTotals(localeRef, id);
      result.totals = totals;
      result.expectedCash =
        Math.round(
          ((data.openingCash || 0) +
            (totals.payments?.cash?.total || 0) -
            (totals.totalChange || 0)) * 100
        ) / 100;
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error en GET /api/shifts/[id]:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
