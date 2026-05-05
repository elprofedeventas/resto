/* RESTO — /api/orders/:id/items/:itemId/ready
   POST { localeId } → marca el item como 'ready' (registra readyAt).
   Si tras este cambio todos los items quedan 'ready', la orden pasa a
   status 'served'.
   Permisos: owner, manager, cook, bar. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';
import { computeStatus } from '../_lib/orderStatus.js';

const ROLES_PERMITTED = ['owner', 'manager', 'cook', 'bar'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
      const items = Array.isArray(order.items) ? order.items.slice() : [];
      const idx = items.findIndex((it) => it.id === itemId);
      if (idx === -1) throw new Error('Item no encontrado.');
      const item = items[idx];
      if (item.kitchenStatus === 'ready') {
        throw new Error('El item ya está listo.');
      }
      if (item.kitchenStatus !== 'kitchen') {
        throw new Error('El item no está en cocina.');
      }
      const restrictByStation =
        session.role === 'cook' || session.role === 'bar';
      if (restrictByStation) {
        const stations =
          session.role === 'cook' ? ['hot', 'cold'] : ['bar'];
        if (!stations.includes(item.station)) {
          throw new Error('Este item no es de tu estación.');
        }
      }
      items[idx] = {
        ...item,
        kitchenStatus: 'ready',
        readyAt: Date.now()
      };
      const newStatus = computeStatus(items, order.status);
      tx.update(orderRef, { items, status: newStatus });
      return { items, status: newStatus };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = [
      'Orden no encontrada',
      'La orden no está abierta.',
      'Item no encontrado.',
      'El item ya está listo.',
      'El item no está en cocina.',
      'Este item no es de tu estación.'
    ];
    if (known.includes(error.message)) {
      const code = error.message.includes('no encontrad')
        ? 404
        : error.message === 'Este item no es de tu estación.'
          ? 403
          : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en POST /api/orders/[id]/items/[itemId]/ready:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
