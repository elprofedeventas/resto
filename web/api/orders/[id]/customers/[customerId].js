/* RESTO — /api/orders/:id/customers/:customerId
   DELETE ?localeId=X → quita un comensal. Los items que tenía asignados
   se desasignan (customerId = null), no se borran. */

import '../../../_lib/loadEnv.js';
import { getDb } from '../../../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../../../_lib/requireSession.js';

const ROLES_PERMITTED = ['owner', 'manager', 'waiter'];

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await requireSession(req, res, { roles: ROLES_PERMITTED });
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const { id, customerId } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de orden inválido' });
  }
  if (!customerId || typeof customerId !== 'string') {
    return res.status(400).json({ error: 'customerId inválido' });
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

      const customers = Array.isArray(order.customers) ? order.customers : [];
      const exists = customers.some((c) => c.id === customerId);
      if (!exists) throw new Error('Comensal no encontrado.');

      const newCustomers = customers.filter((c) => c.id !== customerId);
      const items = Array.isArray(order.items) ? order.items : [];
      const newItems = items.map((it) =>
        it.customerId === customerId ? { ...it, customerId: null } : it
      );

      tx.update(orderRef, { customers: newCustomers, items: newItems });
      return { customers: newCustomers, items: newItems };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = [
      'Orden no encontrada',
      'La orden no está abierta.',
      'Comensal no encontrado.'
    ];
    if (known.includes(error.message)) {
      const code = error.message.includes('no encontrad') ? 404 : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en DELETE /api/orders/[id]/customers/[customerId]:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
