/* RESTO — /api/panel/alerts
   GET ?localeId=X → alertas operativas del local.

   Categorías incluidas en V1:
     - marginAtRisk: platos activos con receta cuyo margen actual está debajo
       del targetMargin definido en settings del restaurante.
     - delayedOrders: órdenes 'open' con items en cocina hace más de 15 min.
     - cashDiscrepancies: turnos cerrados en los últimos 7 días con diff!=0.

   Stock bajo se difiere a V2 (requiere modelo de inventario con cantidades). */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

const ROLES_PERMITTED = ['owner', 'manager'];
const KITCHEN_DELAY_THRESHOLD_MS = 15 * 60 * 1000;
const SHIFT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await requireSession(req, res, { roles: ROLES_PERMITTED });
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const db = getDb();
  const restaurantRef = db.collection('restaurants').doc(session.restaurantId);
  const localeRef = restaurantRef.collection('locales').doc(localeId);

  try {
    const lookbackStart = Date.now() - SHIFT_LOOKBACK_MS;

    const [
      restaurantSnap,
      ingredientsSnap,
      recipesSnap,
      dishesSnap,
      ordersSnap,
      shiftsSnap
    ] = await Promise.all([
      restaurantRef.get(),
      restaurantRef.collection('ingredients').get(),
      restaurantRef.collection('recipes').get(),
      restaurantRef.collection('menu').get(),
      localeRef.collection('orders').where('status', '==', 'open').get(),
      localeRef
        .collection('shifts')
        .where('closedAt', '>=', lookbackStart)
        .get()
    ]);

    const settings = restaurantSnap.exists
      ? restaurantSnap.data().settings || {}
      : {};
    const targetMargin =
      typeof settings.targetMargin === 'number' ? settings.targetMargin : 0.6;

    // === Margen en riesgo ===
    const ingredientPrice = new Map();
    ingredientsSnap.docs.forEach((d) => {
      ingredientPrice.set(d.id, d.data().currentPrice || 0);
    });

    const dishUnitCost = new Map();
    recipesSnap.docs.forEach((d) => {
      const items = Array.isArray(d.data().items) ? d.data().items : [];
      if (items.length === 0) return;
      let cost = 0;
      for (const it of items) {
        cost += (ingredientPrice.get(it.ingredientId) || 0) * (it.quantity || 0);
      }
      dishUnitCost.set(d.id, cost);
    });

    const marginAtRisk = [];
    for (const dishDoc of dishesSnap.docs) {
      const data = dishDoc.data();
      if (data.active === false) continue;
      const unitCost = dishUnitCost.get(dishDoc.id);
      if (unitCost === undefined) continue;
      const basePrice = data.basePrice || 0;
      if (basePrice <= 0) continue;
      const margin = (basePrice - unitCost) / basePrice;
      if (margin < targetMargin) {
        marginAtRisk.push({
          dishId: dishDoc.id,
          name: data.name,
          basePrice: round2(basePrice),
          cost: round2(unitCost),
          margin: round2(margin)
        });
      }
    }
    marginAtRisk.sort((a, b) => a.margin - b.margin);

    // === Comandas demoradas ===
    const now = Date.now();
    const delayedOrders = [];
    for (const orderDoc of ordersSnap.docs) {
      const order = orderDoc.data();
      if (!Array.isArray(order.items)) continue;
      const delayedItems = order.items.filter(
        (it) =>
          it.kitchenStatus === 'kitchen' &&
          it.sentToKitchenAt &&
          now - it.sentToKitchenAt > KITCHEN_DELAY_THRESHOLD_MS
      );
      if (delayedItems.length === 0) continue;
      const oldest = delayedItems.reduce(
        (a, it) =>
          a === null || it.sentToKitchenAt < a ? it.sentToKitchenAt : a,
        null
      );
      delayedOrders.push({
        orderId: orderDoc.id,
        orderNumber: order.orderNumber,
        type: order.type,
        tableNumber: order.tableNumber || null,
        takeoutName: order.takeoutName || null,
        waiterName: order.waiterName,
        delayedCount: delayedItems.length,
        oldestSentAt: oldest,
        elapsedMin: Math.floor((now - oldest) / 60000)
      });
    }
    delayedOrders.sort((a, b) => b.elapsedMin - a.elapsedMin);

    // === Cuadre con diferencia ===
    const cashDiscrepancies = [];
    for (const shiftDoc of shiftsSnap.docs) {
      const shift = shiftDoc.data();
      if (shift.status !== 'closed') continue;
      if (!shift.diff || shift.diff === 0) continue;
      cashDiscrepancies.push({
        shiftId: shiftDoc.id,
        closedAt: shift.closedAt,
        closedByName: shift.closedByName,
        openingCash: shift.openingCash,
        closingCash: shift.closingCash,
        expectedCash: shift.expectedCash,
        diff: shift.diff
      });
    }
    cashDiscrepancies.sort((a, b) => b.closedAt - a.closedAt);

    return res.status(200).json({
      targetMargin,
      thresholds: {
        kitchenDelayMinutes: KITCHEN_DELAY_THRESHOLD_MS / 60000,
        shiftLookbackDays: SHIFT_LOOKBACK_MS / (24 * 60 * 60 * 1000)
      },
      marginAtRisk,
      delayedOrders,
      cashDiscrepancies
    });
  } catch (error) {
    console.error('Error en GET /api/panel/alerts:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
