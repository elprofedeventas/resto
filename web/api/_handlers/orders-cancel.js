/* RESTO — /api/orders/:id/cancel
   POST { localeId } → cancela la orden.
   Permisos:
     - owner, manager: siempre.
     - waiter: solo si es el waiter que abrió la orden.
   Si la orden era de mesa, libera la mesa (activeOrderId = null). */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
  const orderRef = localeRef.collection('orders').doc(id);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error('Orden no encontrada');
      const order = snap.data();
      if (order.status !== 'open') {
        throw new Error('Solo se pueden cancelar órdenes abiertas.');
      }

      const isOwnerOrManager =
        session.role === 'owner' || session.role === 'manager';
      const isOwnWaiterOrder =
        session.role === 'waiter' && order.waiterId === session.userId;
      if (!isOwnerOrManager && !isOwnWaiterOrder) {
        throw new Error('No autorizado.');
      }

      const now = Date.now();
      tx.update(orderRef, {
        status: 'cancelled',
        cancelledAt: now
      });

      if (order.type === 'table' && order.tableId) {
        const tableRef = localeRef.collection('tables').doc(order.tableId);
        tx.update(tableRef, {
          activeOrderId: null,
          openedAt: null
        });
      }

      return { ok: true };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = [
      'Orden no encontrada',
      'Solo se pueden cancelar órdenes abiertas.',
      'No autorizado.'
    ];
    if (known.includes(error.message)) {
      const code =
        error.message === 'Orden no encontrada'
          ? 404
          : error.message === 'No autorizado.'
            ? 403
            : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en POST /api/orders/[id]/cancel:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
