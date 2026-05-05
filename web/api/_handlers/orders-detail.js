/* RESTO — /api/orders/:id
   GET ?localeId=X → cualquier rol logueado del local. Detalle de la orden. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

function sanitizeOrder(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    orderNumber: data.orderNumber,
    type: data.type,
    tableId: data.tableId || null,
    tableNumber: data.tableNumber || null,
    takeoutName: data.takeoutName || null,
    waiterId: data.waiterId,
    waiterName: data.waiterName,
    status: data.status,
    items: Array.isArray(data.items) ? data.items : [],
    customers: Array.isArray(data.customers) ? data.customers : [],
    subtotal: typeof data.subtotal === 'number' ? data.subtotal : 0,
    openedAt: data.openedAt || null,
    closedAt: data.closedAt || null,
    cancelledAt: data.cancelledAt || null
  };
}

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
  const ref = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId)
    .collection('orders').doc(id);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    return res.status(200).json(sanitizeOrder(snap));
  } catch (error) {
    console.error('Error en GET /api/orders/[id]:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
