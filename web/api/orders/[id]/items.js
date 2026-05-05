/* RESTO — /api/orders/:id/items
   POST  { localeId, dishId, quantity, observations? }
         → agrega item a la orden. kitchenStatus inicia en 'pending'.
         El precio se denormaliza desde el menú (incluye override por local
         si está activado). El subtotal se recalcula.
   PATCH { localeId, itemId, customerId | null }
         → asigna o desasigna el item a un comensal de la orden. Si
         customerId es null, el item queda como "general". */

import '../../_lib/loadEnv.js';
import crypto from 'node:crypto';
import { getDb } from '../../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../../_lib/requireSession.js';
import { computeStatus } from '../../_lib/orderStatus.js';

const ROLES_PERMITTED = ['owner', 'manager', 'waiter'];

async function resolveDishPrice(restaurantRef, dishId, localeId, pricePerLocaleEnabled) {
  const dishRef = restaurantRef.collection('menu').doc(dishId);
  const dishSnap = await dishRef.get();
  if (!dishSnap.exists) {
    return { error: 'Plato no encontrado.' };
  }
  const dish = dishSnap.data();
  if (dish.active === false) {
    return { error: 'Plato inactivo.' };
  }

  let price = typeof dish.basePrice === 'number' ? dish.basePrice : 0;
  if (pricePerLocaleEnabled) {
    const overrideSnap = await dishRef
      .collection('localOverrides').doc(localeId)
      .get();
    if (overrideSnap.exists && typeof overrideSnap.data().price === 'number') {
      price = overrideSnap.data().price;
    }
  }
  return {
    name: dish.name,
    station: dish.station || 'hot',
    price
  };
}

function recalcSubtotal(items) {
  return items.reduce(
    (sum, it) => sum + (it.basePrice || 0) * (it.quantity || 0),
    0
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
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
  const restaurantRef = db.collection('restaurants').doc(session.restaurantId);
  const orderRef = restaurantRef
    .collection('locales').doc(localeId)
    .collection('orders').doc(id);

  if (req.method === 'POST') {
    const { dishId, quantity, observations } = req.body || {};
    if (typeof dishId !== 'string' || !dishId) {
      return res.status(400).json({ error: 'dishId requerido.' });
    }
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ error: 'Cantidad inválida (entero > 0).' });
    }
    if (observations !== undefined && typeof observations !== 'string') {
      return res.status(400).json({ error: 'Observaciones inválidas.' });
    }

    try {
      const restaurantSnap = await restaurantRef.get();
      const settings = restaurantSnap.exists
        ? restaurantSnap.data().settings || {}
        : {};
      const pricePerLocaleEnabled = settings.pricePerLocaleEnabled === true;

      const dishInfo = await resolveDishPrice(
        restaurantRef,
        dishId,
        localeId,
        pricePerLocaleEnabled
      );
      if (dishInfo.error) {
        return res.status(400).json({ error: dishInfo.error });
      }

      const result = await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) throw new Error('Orden no encontrada');
        const order = orderSnap.data();
        if (order.status !== 'open') {
          throw new Error('La orden no está abierta.');
        }

        const newItem = {
          id: crypto.randomUUID(),
          dishId,
          dishName: dishInfo.name,
          station: dishInfo.station,
          basePrice: dishInfo.price,
          quantity: qty,
          observations: typeof observations === 'string' ? observations.trim() : '',
          customerId: null,
          kitchenStatus: 'pending',
          addedAt: Date.now(),
          sentToKitchenAt: null,
          readyAt: null
        };

        const items = Array.isArray(order.items) ? order.items.slice() : [];
        items.push(newItem);
        const subtotal = recalcSubtotal(items);
        const newStatus = computeStatus(items, order.status);

        tx.update(orderRef, { items, subtotal, status: newStatus });
        return { items, subtotal, newItem, status: newStatus };
      });

      return res.status(200).json(result);
    } catch (error) {
      const known = ['Orden no encontrada', 'La orden no está abierta.'];
      if (known.includes(error.message)) {
        const code = error.message === 'Orden no encontrada' ? 404 : 400;
        return res.status(code).json({ error: error.message });
      }
      console.error('Error en POST /api/orders/[id]/items:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  // PATCH: asignar item a comensal
  const { itemId, customerId } = req.body || {};
  if (typeof itemId !== 'string' || !itemId) {
    return res.status(400).json({ error: 'itemId requerido.' });
  }
  if (customerId !== null && typeof customerId !== 'string') {
    return res.status(400).json({ error: 'customerId debe ser string o null.' });
  }

  try {
    const result = await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new Error('Orden no encontrada');
      const order = orderSnap.data();
      if (order.status !== 'open') {
        throw new Error('La orden no está abierta.');
      }

      if (customerId !== null) {
        const customers = Array.isArray(order.customers) ? order.customers : [];
        const exists = customers.some((c) => c.id === customerId);
        if (!exists) throw new Error('Comensal no encontrado.');
      }

      const items = Array.isArray(order.items) ? order.items.slice() : [];
      const idx = items.findIndex((it) => it.id === itemId);
      if (idx === -1) throw new Error('Item no encontrado.');
      items[idx] = { ...items[idx], customerId };

      tx.update(orderRef, { items });
      return { items, item: items[idx] };
    });

    return res.status(200).json(result);
  } catch (error) {
    const known = [
      'Orden no encontrada',
      'La orden no está abierta.',
      'Comensal no encontrado.',
      'Item no encontrado.'
    ];
    if (known.includes(error.message)) {
      const code = error.message.includes('no encontrad') ? 404 : 400;
      return res.status(code).json({ error: error.message });
    }
    console.error('Error en PATCH /api/orders/[id]/items:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
