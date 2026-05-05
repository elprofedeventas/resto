/* RESTO — /api/orders/:id/send-to-kitchen
   POST { localeId } → marca todos los items con kitchenStatus 'pending' como
                       'kitchen' y registra `sentToKitchenAt`. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

const ROLES_PERMITTED = ['owner', 'manager', 'waiter'];

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
      const now = Date.now();
      let sent = 0;
      const newItems = items.map((it) => {
        if (it.kitchenStatus === 'pending') {
          sent += 1;
          return { ...it, kitchenStatus: 'kitchen', sentToKitchenAt: now };
        }
        return it;
      });
      if (sent === 0) {
        throw new Error('No hay items pendientes de enviar.');
      }
      tx.update(orderRef, { items: newItems });
      return { items: newItems, sent };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = [
      'Orden no encontrada',
      'La orden no está abierta.',
      'No hay items pendientes de enviar.'
    ];
    if (known.includes(error.message)) {
      const code = error.message === 'Orden no encontrada' ? 404 : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en POST /api/orders/[id]/send-to-kitchen:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
