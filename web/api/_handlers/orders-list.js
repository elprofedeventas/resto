/* RESTO — /api/orders
   GET  ?localeId=X[&status=open|closed|cancelled]
        → lista órdenes del local. Cualquier rol logueado del local.
   POST { localeId, type: 'table'|'takeout', tableId?, takeoutName? }
        → crea orden. Owner, manager o waiter del local.
        Para type='table' valida que la mesa exista y esté libre, y la asocia
        seteando activeOrderId. */

import '../_lib/loadEnv.js';
import crypto from 'node:crypto';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

const VALID_STATUS = ['open', 'served', 'closed', 'cancelled'];
const ORDER_CREATE_ROLES = ['owner', 'manager', 'waiter'];

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

function generateOrderNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ORD-${yyyy}${mm}${dd}-${rand}`;
}

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const db = getDb();
  const localeRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId);
  const ordersRef = localeRef.collection('orders');

  if (req.method === 'GET') {
    try {
      let q = ordersRef;
      const rawStatus = req.query?.status;
      if (typeof rawStatus === 'string' && rawStatus.length > 0) {
        const requested = rawStatus
          .split(',')
          .map((s) => s.trim())
          .filter((s) => VALID_STATUS.includes(s));
        if (requested.length === 1) {
          q = q.where('status', '==', requested[0]);
        } else if (requested.length > 1) {
          q = q.where('status', 'in', requested);
        }
      }
      const snap = await q.get();
      const orders = snap.docs.map(sanitizeOrder);
      orders.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
      return res.status(200).json({ orders });
    } catch (error) {
      console.error('Error en GET /api/orders:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'POST') {
    if (!ORDER_CREATE_ROLES.includes(session.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { type, tableId, takeoutName } = req.body || {};
    if (type !== 'table' && type !== 'takeout') {
      return res.status(400).json({ error: 'Tipo de orden inválido.' });
    }
    if (type === 'table' && (typeof tableId !== 'string' || !tableId)) {
      return res.status(400).json({ error: 'tableId requerido para mesa.' });
    }
    if (
      type === 'takeout' &&
      typeof takeoutName === 'string' &&
      takeoutName.length > 60
    ) {
      return res.status(400).json({ error: 'Nombre demasiado largo.' });
    }

    const now = Date.now();
    const orderNumber = generateOrderNumber();
    let tableNumber = null;

    try {
      if (type === 'table') {
        const tableRef = localeRef.collection('tables').doc(tableId);
        const result = await db.runTransaction(async (tx) => {
          const tableSnap = await tx.get(tableRef);
          if (!tableSnap.exists) throw new Error('Mesa no encontrada');
          const tableData = tableSnap.data();
          if (tableData.active === false) {
            throw new Error('La mesa no está activa.');
          }
          if (tableData.activeOrderId) {
            throw new Error('La mesa ya está ocupada.');
          }
          tableNumber = tableData.number;

          const newOrderRef = ordersRef.doc();
          tx.set(newOrderRef, {
            orderNumber,
            type: 'table',
            tableId,
            tableNumber,
            takeoutName: null,
            waiterId: session.userId,
            waiterName: session.name,
            status: 'open',
            items: [],
            subtotal: 0,
            openedAt: now,
            closedAt: null,
            cancelledAt: null
          });

          tx.update(tableRef, {
            activeOrderId: newOrderRef.id,
            openedAt: now
          });

          return newOrderRef.id;
        });

        const created = await ordersRef.doc(result).get();
        return res.status(201).json(sanitizeOrder(created));
      }

      // type === 'takeout'
      const docRef = await ordersRef.add({
        orderNumber,
        type: 'takeout',
        tableId: null,
        tableNumber: null,
        takeoutName: typeof takeoutName === 'string' ? takeoutName.trim() : '',
        waiterId: session.userId,
        waiterName: session.name,
        status: 'open',
        items: [],
        subtotal: 0,
        openedAt: now,
        closedAt: null,
        cancelledAt: null
      });
      const created = await docRef.get();
      return res.status(201).json(sanitizeOrder(created));
    } catch (error) {
      const known = [
        'Mesa no encontrada',
        'La mesa no está activa.',
        'La mesa ya está ocupada.'
      ];
      if (known.includes(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error en POST /api/orders:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
