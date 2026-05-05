/* RESTO — /api/shifts
   GET  ?localeId=X[&status=open|closed]
        → lista turnos del local. Cualquier rol con acceso al local.
   POST { localeId, openingCash, notes? }
        → abre un turno. Solo permitido si no hay otro abierto en el local.
        Roles: cashier, manager, owner. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

const ROLES_PERMITTED = ['owner', 'manager', 'cashier'];
const VALID_STATUS = ['open', 'closed'];

function sanitize(doc) {
  const data = doc.data();
  return {
    id: doc.id,
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
}

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const db = getDb();
  const ref = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId)
    .collection('shifts');

  if (req.method === 'GET') {
    try {
      let q = ref;
      const status = req.query?.status;
      if (typeof status === 'string' && VALID_STATUS.includes(status)) {
        q = q.where('status', '==', status);
      }
      const snap = await q.get();
      const shifts = snap.docs.map(sanitize);
      shifts.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
      return res.status(200).json({ shifts });
    } catch (error) {
      console.error('Error en GET /api/shifts:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'POST') {
    if (!ROLES_PERMITTED.includes(session.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { openingCash, notes } = req.body || {};
    const cashNum = Number(openingCash);
    if (Number.isNaN(cashNum) || cashNum < 0) {
      return res.status(400).json({ error: 'Efectivo inicial inválido.' });
    }

    try {
      const result = await db.runTransaction(async (tx) => {
        const openSnap = await tx.get(ref.where('status', '==', 'open').limit(1));
        if (!openSnap.empty) {
          throw new Error('Ya hay un turno abierto en este local.');
        }
        const docRef = ref.doc();
        const now = Date.now();
        const data = {
          status: 'open',
          openedAt: now,
          openedById: session.userId,
          openedByName: session.name,
          openingCash: Math.round(cashNum * 100) / 100,
          notes: typeof notes === 'string' ? notes.trim() : '',
          closedAt: null,
          closedById: null,
          closedByName: null,
          closingCash: null,
          expectedCash: null,
          diff: null,
          totals: null
        };
        tx.set(docRef, data);
        return { id: docRef.id, ...data };
      });

      return res.status(201).json(result);
    } catch (error) {
      if (error.message === 'Ya hay un turno abierto en este local.') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Error en POST /api/shifts:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
