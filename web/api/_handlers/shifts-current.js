/* RESTO — /api/shifts/current
   GET ?localeId=X → devuelve el turno abierto del local (con totales en vivo)
                     o null si no hay. */

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

  const db = getDb();
  const localeRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId);
  const ref = localeRef.collection('shifts');

  try {
    const snap = await ref.where('status', '==', 'open').limit(1).get();
    if (snap.empty) {
      return res.status(200).json({ shift: null });
    }
    const doc = snap.docs[0];
    const data = doc.data();
    const totals = await computeShiftTotals(localeRef, doc.id);

    const expectedCash =
      Math.round(
        ((data.openingCash || 0) +
          (totals.payments?.cash?.total || 0) -
          (totals.totalChange || 0)) * 100
      ) / 100;

    return res.status(200).json({
      shift: {
        id: doc.id,
        status: data.status,
        openedAt: data.openedAt || null,
        openedById: data.openedById,
        openedByName: data.openedByName,
        openingCash: data.openingCash || 0,
        notes: data.notes || '',
        totals,
        expectedCash
      }
    });
  } catch (error) {
    console.error('Error en GET /api/shifts/current:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
