/* RESTO — /api/orders/:id/customers
   POST { localeId, name } → agrega un comensal a la orden.
   El id del comensal se genera con crypto.randomUUID. */

import '../../../_lib/loadEnv.js';
import crypto from 'node:crypto';
import { getDb } from '../../../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../../../_lib/requireSession.js';

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

  const { name } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nombre del comensal obligatorio.' });
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

      const customers = Array.isArray(order.customers)
        ? order.customers.slice()
        : [];
      const newCustomer = {
        id: crypto.randomUUID(),
        name: name.trim()
      };
      customers.push(newCustomer);
      tx.update(orderRef, { customers });
      return { customer: newCustomer, customers };
    });

    return res.status(201).json(result);
  } catch (error) {
    const known = ['Orden no encontrada', 'La orden no está abierta.'];
    if (known.includes(error.message)) {
      const code = error.message === 'Orden no encontrada' ? 404 : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en POST /api/orders/[id]/customers:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
