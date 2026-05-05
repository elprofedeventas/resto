/* RESTO — /api/orders/:id/items/:itemId
   DELETE ?localeId=X → quita un item de la orden.
   Reglas:
     - Solo se puede quitar si kitchenStatus === 'pending' (no salió a cocina).
     - Roles: owner, manager, waiter del local.
     - Recalcula subtotal y status (puede pasar a 'served' si era el último
       no-ready). */

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
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await requireSession(req, res, { roles: ROLES_PERMITTED });
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const { id, itemId } = req.query;
  if (!id || typeof id !== 'string' || !itemId || typeof itemId !== 'string') {
    return res.status(400).json({ error: 'IDs inválidos' });
  }

  const db = getDb();
  const orderRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId)
    .collection('orders').doc(id);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error('Orden no encontrada');
      const order = snap.data();
      if (order.status !== 'open') {
        throw new Error('La orden no está abierta.');
      }
      const items = Array.isArray(order.items) ? order.items : [];
      const item = items.find((it) => it.id === itemId);
      if (!item) throw new Error('Item no encontrado.');
      if (item.kitchenStatus !== 'pending') {
        throw new Error(
          'No se puede quitar un item que ya fue enviado a cocina.'
        );
      }
      const filtered = items.filter((it) => it.id !== itemId);
      const subtotal = recalcSubtotal(filtered);
      const newStatus = computeStatus(filtered, order.status);
      tx.update(orderRef, { items: filtered, subtotal, status: newStatus });
      return { items: filtered, subtotal, status: newStatus };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = [
      'Orden no encontrada',
      'La orden no está abierta.',
      'Item no encontrado.',
      'No se puede quitar un item que ya fue enviado a cocina.'
    ];
    if (known.includes(error.message)) {
      const code = error.message.includes('no encontrad') ? 404 : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en DELETE /api/orders/[id]/items/[itemId]:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
