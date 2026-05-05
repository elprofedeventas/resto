/* RESTO — /api/orders/:id/close
   POST { localeId, discount?, tip?, payments }
        → cobra y cierra una orden. Roles: cashier, manager, owner.

   Body:
     - discount: null | { type: 'percent' | 'amount', value: number }
     - tip: number >= 0
     - payments: [{ method: 'cash'|'card'|'transfer'|'app', amount: number, reference?: string }]

   Crea un doc en `sales/` con snapshot completo. La orden queda con
   status='closed', saleId, closedAt. Si era mesa, libera la mesa. */

import '../_lib/loadEnv.js';
import crypto from 'node:crypto';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

const ROLES_PERMITTED = ['owner', 'manager', 'cashier'];
const VALID_PAYMENT_METHODS = ['cash', 'card', 'transfer', 'app'];

function generateSaleNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SALE-${y}${m}${d}-${rand}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
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

  const body = req.body || {};
  const { discount, tip, payments } = body;

  if (discount && typeof discount === 'object') {
    if (!['percent', 'amount'].includes(discount.type)) {
      return res.status(400).json({ error: 'Tipo de descuento inválido.' });
    }
    if (typeof discount.value !== 'number' || discount.value < 0) {
      return res.status(400).json({ error: 'Valor de descuento inválido.' });
    }
    if (discount.type === 'percent' && discount.value > 100) {
      return res.status(400).json({ error: 'El descuento no puede superar 100%.' });
    }
  }

  const tipNum = typeof tip === 'number' ? tip : 0;
  if (tipNum < 0) {
    return res.status(400).json({ error: 'La propina no puede ser negativa.' });
  }

  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ error: 'Debe registrar al menos un pago.' });
  }

  const cleanPayments = [];
  for (const p of payments) {
    if (!p || !VALID_PAYMENT_METHODS.includes(p.method)) {
      return res.status(400).json({ error: 'Método de pago inválido.' });
    }
    const amount = Number(p.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Monto de pago inválido.' });
    }
    cleanPayments.push({
      method: p.method,
      amount: round2(amount),
      reference:
        typeof p.reference === 'string' ? p.reference.trim() : ''
    });
  }

  const db = getDb();
  const localeRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId);
  const orderRef = localeRef.collection('orders').doc(id);
  const salesRef = localeRef.collection('sales');

  try {
    // Buscar shift abierto del local fuera de la transaction.
    const shiftSnap = await localeRef
      .collection('shifts')
      .where('status', '==', 'open')
      .limit(1)
      .get();
    const shiftId = shiftSnap.empty ? null : shiftSnap.docs[0].id;

    const result = await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new Error('Orden no encontrada');
      const order = orderSnap.data();

      if (order.status !== 'open' && order.status !== 'served') {
        throw new Error('La orden no se puede cobrar (ya cerrada o cancelada).');
      }

      const items = Array.isArray(order.items) ? order.items : [];
      if (items.length === 0) {
        throw new Error('La orden no tiene items.');
      }

      const subtotal = items.reduce(
        (s, it) => s + (it.basePrice || 0) * (it.quantity || 0),
        0
      );

      let discountApplied = 0;
      let discountSnapshot = null;
      if (discount && typeof discount === 'object') {
        if (discount.type === 'percent') {
          discountApplied = round2((subtotal * discount.value) / 100);
        } else {
          discountApplied = round2(Math.min(discount.value, subtotal));
        }
        discountSnapshot = {
          type: discount.type,
          value: discount.value,
          applied: discountApplied
        };
      }

      const totalToPay = round2(subtotal - discountApplied + tipNum);
      const totalPaid = round2(
        cleanPayments.reduce((s, p) => s + p.amount, 0)
      );
      if (totalPaid + 0.005 < totalToPay) {
        throw new Error('Los pagos no cubren el total.');
      }
      const change = round2(Math.max(0, totalPaid - totalToPay));

      const now = Date.now();
      const saleNumber = generateSaleNumber();
      const saleRef = salesRef.doc();
      const saleData = {
        saleNumber,
        shiftId,
        orderId: orderRef.id,
        orderNumber: order.orderNumber,
        type: order.type,
        tableId: order.tableId || null,
        tableNumber: order.tableNumber || null,
        takeoutName: order.takeoutName || null,
        waiterId: order.waiterId,
        waiterName: order.waiterName,
        cashierId: session.userId,
        cashierName: session.name,
        items: items.map((it) => ({
          id: it.id,
          dishId: it.dishId,
          dishName: it.dishName,
          basePrice: it.basePrice,
          quantity: it.quantity,
          observations: it.observations || '',
          customerId: it.customerId || null,
          station: it.station,
          kitchenStatus: it.kitchenStatus
        })),
        customers: Array.isArray(order.customers) ? order.customers : [],
        subtotal: round2(subtotal),
        discount: discountSnapshot,
        tip: round2(tipNum),
        totalToPay,
        payments: cleanPayments,
        totalPaid,
        change,
        closedAt: now
      };
      tx.set(saleRef, saleData);

      tx.update(orderRef, {
        status: 'closed',
        closedAt: now,
        saleId: saleRef.id,
        saleNumber
      });

      if (order.type === 'table' && order.tableId) {
        const tableRef = localeRef.collection('tables').doc(order.tableId);
        tx.update(tableRef, {
          activeOrderId: null,
          openedAt: null
        });
      }

      return { saleId: saleRef.id, sale: saleData };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = [
      'Orden no encontrada',
      'La orden no se puede cobrar (ya cerrada o cancelada).',
      'La orden no tiene items.',
      'Los pagos no cubren el total.'
    ];
    if (known.includes(error.message)) {
      const code = error.message === 'Orden no encontrada' ? 404 : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en POST /api/orders/[id]/close:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
