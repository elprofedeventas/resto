/* RESTO — /api/shifts/:id/close
   POST { localeId, closingCash, notes? }
        → cierra el turno. Calcula totales finales y diferencia entre
        efectivo declarado y teórico. Roles: cashier, manager, owner. */

import '../../_lib/loadEnv.js';
import { getDb } from '../../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../../_lib/requireSession.js';
import { computeShiftTotals } from '../../_lib/shiftTotals.js';

const ROLES_PERMITTED = ['owner', 'manager', 'cashier'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await requireSession(req, res, { roles: ROLES_PERMITTED });
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const { closingCash, notes } = req.body || {};
  const cashNum = Number(closingCash);
  if (Number.isNaN(cashNum) || cashNum < 0) {
    return res.status(400).json({ error: 'Efectivo declarado inválido.' });
  }

  const db = getDb();
  const localeRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId);
  const ref = localeRef.collection('shifts').doc(id);

  try {
    // Calcular totales fuera de la transaction (lectura separada).
    const totals = await computeShiftTotals(localeRef, id);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Turno no encontrado');
      const data = snap.data();
      if (data.status !== 'open') {
        throw new Error('El turno ya está cerrado.');
      }

      const expectedCash = round2(
        (data.openingCash || 0) +
          (totals.payments?.cash?.total || 0) -
          (totals.totalChange || 0)
      );
      const closingCashRound = round2(cashNum);
      const diff = round2(closingCashRound - expectedCash);
      const now = Date.now();

      const update = {
        status: 'closed',
        closedAt: now,
        closedById: session.userId,
        closedByName: session.name,
        closingCash: closingCashRound,
        expectedCash,
        diff,
        totals
      };
      if (typeof notes === 'string' && notes.trim()) {
        update.notes = ((data.notes ? data.notes + '\n' : '') + notes.trim()).slice(0, 1000);
      }

      tx.update(ref, update);

      return {
        id: snap.id,
        ...data,
        ...update
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = ['Turno no encontrado', 'El turno ya está cerrado.'];
    if (known.includes(error.message)) {
      const code = error.message === 'Turno no encontrado' ? 404 : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en POST /api/shifts/[id]/close:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
