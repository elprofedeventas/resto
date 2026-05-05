/* RESTO — /api/orders/:id/move-item
   POST { localeId, itemId, targetOrderId }
        → mueve un item de la orden origen a otra orden abierta.
        Mantiene el kitchenStatus, observations, y demás campos del item.
        Recalcula subtotales de ambas órdenes. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';
import { computeStatus } from '../_lib/orderStatus.js';

const ROLES_PERMITTED = ['owner', 'manager', 'waiter'];

function recalcSubtotal(items) {
  return items.reduce(
    (sum, it) => sum + (it.basePrice || 0) * (it.quantity || 0),
    0
  );
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

  const { itemId, targetOrderId } = req.body || {};
  if (typeof itemId !== 'string' || !itemId) {
    return res.status(400).json({ error: 'itemId requerido.' });
  }
  if (typeof targetOrderId !== 'string' || !targetOrderId) {
    return res.status(400).json({ error: 'targetOrderId requerido.' });
  }
  if (targetOrderId === id) {
    return res.status(400).json({ error: 'La orden destino debe ser distinta.' });
  }

  const db = getDb();
  const localeRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId);
  const fromRef = localeRef.collection('orders').doc(id);
  const toRef = localeRef.collection('orders').doc(targetOrderId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const [fromSnap, toSnap] = await Promise.all([
        tx.get(fromRef),
        tx.get(toRef)
      ]);
      if (!fromSnap.exists) throw new Error('Orden origen no encontrada');
      if (!toSnap.exists) throw new Error('Orden destino no encontrada');
      const from = fromSnap.data();
      const to = toSnap.data();
      if (from.status !== 'open') {
        throw new Error('La orden origen no está abierta.');
      }
      if (to.status !== 'open') {
        throw new Error('La orden destino no está abierta.');
      }

      const fromItems = Array.isArray(from.items) ? from.items.slice() : [];
      const item = fromItems.find((it) => it.id === itemId);
      if (!item) throw new Error('Item no encontrado.');

      const newFromItems = fromItems.filter((it) => it.id !== itemId);
      const toItems = Array.isArray(to.items) ? to.items.slice() : [];
      toItems.push(item);

      tx.update(fromRef, {
        items: newFromItems,
        subtotal: recalcSubtotal(newFromItems),
        status: computeStatus(newFromItems, from.status)
      });
      tx.update(toRef, {
        items: toItems,
        subtotal: recalcSubtotal(toItems),
        status: computeStatus(toItems, to.status)
      });

      return { ok: true };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = [
      'Orden origen no encontrada',
      'Orden destino no encontrada',
      'La orden origen no está abierta.',
      'La orden destino no está abierta.',
      'Item no encontrado.'
    ];
    if (known.includes(error.message)) {
      const code = error.message.includes('no encontrad') ? 404 : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en POST /api/orders/[id]/move-item:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
