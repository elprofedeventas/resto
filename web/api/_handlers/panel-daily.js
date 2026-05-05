/* RESTO — /api/panel/daily
   GET ?localeId=X&startMs=Y&endMs=Z
       → métricas del día (rango epoch [startMs, endMs)) para el local.
   Permisos: owner, manager. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

const ROLES_PERMITTED = ['owner', 'manager'];

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

  const startMs = Number(req.query?.startMs);
  const endMs = Number(req.query?.endMs);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    return res.status(400).json({ error: 'Rango de fechas inválido.' });
  }

  const db = getDb();
  const restaurantRef = db.collection('restaurants').doc(session.restaurantId);
  const localeRef = restaurantRef.collection('locales').doc(localeId);

  try {
    const [salesSnap, ingredientsSnap, recipesSnap] = await Promise.all([
      localeRef
        .collection('sales')
        .where('closedAt', '>=', startMs)
        .where('closedAt', '<', endMs)
        .get(),
      restaurantRef.collection('ingredients').get(),
      restaurantRef.collection('recipes').get()
    ]);

    const ingredientPrice = new Map();
    ingredientsSnap.docs.forEach((d) => {
      ingredientPrice.set(d.id, d.data().currentPrice || 0);
    });

    const dishUnitCost = new Map();
    recipesSnap.docs.forEach((d) => {
      const items = Array.isArray(d.data().items) ? d.data().items : [];
      let cost = 0;
      for (const it of items) {
        const price = ingredientPrice.get(it.ingredientId) || 0;
        cost += price * (it.quantity || 0);
      }
      if (items.length > 0) dishUnitCost.set(d.id, cost);
    });

    const byMethod = {
      cash: { count: 0, total: 0 },
      card: { count: 0, total: 0 },
      transfer: { count: 0, total: 0 },
      app: { count: 0, total: 0 }
    };
    const byType = { table: 0, takeout: 0 };

    let salesCount = 0;
    let salesTotal = 0;
    let tipsTotal = 0;

    let revenueWithRecipe = 0;
    let totalCost = 0;

    const dishStats = new Map();
    const waiterStats = new Map();

    for (const doc of salesSnap.docs) {
      const sale = doc.data();
      salesCount += 1;
      salesTotal += sale.totalToPay || 0;
      tipsTotal += sale.tip || 0;
      if (sale.type === 'table') byType.table += 1;
      else if (sale.type === 'takeout') byType.takeout += 1;

      if (Array.isArray(sale.payments)) {
        for (const p of sale.payments) {
          if (byMethod[p.method]) {
            byMethod[p.method].count += 1;
            byMethod[p.method].total += p.amount || 0;
          }
        }
      }

      // por mesero
      const wid = sale.waiterId || 'sin_mesero';
      const wname = sale.waiterName || 'Sin mesero';
      if (!waiterStats.has(wid)) {
        waiterStats.set(wid, {
          waiterId: wid,
          name: wname,
          salesCount: 0,
          total: 0
        });
      }
      const ws = waiterStats.get(wid);
      ws.salesCount += 1;
      ws.total += sale.totalToPay || 0;

      // por plato + costo
      if (Array.isArray(sale.items)) {
        for (const item of sale.items) {
          const lineRevenue = (item.basePrice || 0) * (item.quantity || 0);
          const did = item.dishId;
          if (did) {
            if (!dishStats.has(did)) {
              dishStats.set(did, {
                dishId: did,
                name: item.dishName || '',
                quantity: 0,
                total: 0
              });
            }
            const ds = dishStats.get(did);
            ds.quantity += item.quantity || 0;
            ds.total += lineRevenue;
          }
          if (dishUnitCost.has(did)) {
            revenueWithRecipe += lineRevenue;
            totalCost += dishUnitCost.get(did) * (item.quantity || 0);
          }
        }
      }
    }

    for (const m of Object.keys(byMethod)) {
      byMethod[m].total = round2(byMethod[m].total);
    }

    const includeAll = req.query?.includeAll === '1';
    const dishLimit = includeAll ? Infinity : 5;
    const waiterLimit = includeAll ? Infinity : 3;

    const sortedDishes = [...dishStats.values()]
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
      .map((d) => ({ ...d, total: round2(d.total) }));
    const topDishes = Number.isFinite(dishLimit)
      ? sortedDishes.slice(0, dishLimit)
      : sortedDishes;

    const waitersArr = [...waiterStats.values()];
    const sortedBySales = [...waitersArr]
      .sort((a, b) => b.total - a.total)
      .map((w) => ({ ...w, total: round2(w.total) }));
    const topWaitersBySales = Number.isFinite(waiterLimit)
      ? sortedBySales.slice(0, waiterLimit)
      : sortedBySales;
    const sortedByAverage = [...waitersArr]
      .map((w) => ({
        ...w,
        average: w.salesCount > 0 ? round2(w.total / w.salesCount) : 0,
        total: round2(w.total)
      }))
      .sort((a, b) => b.average - a.average);
    const topWaitersByAverage = Number.isFinite(waiterLimit)
      ? sortedByAverage.slice(0, waiterLimit)
      : sortedByAverage;

    const grossMarginPercent =
      revenueWithRecipe > 0
        ? (revenueWithRecipe - totalCost) / revenueWithRecipe
        : null;

    return res.status(200).json({
      range: { startMs, endMs },
      sales: {
        count: salesCount,
        total: round2(salesTotal),
        average: salesCount > 0 ? round2(salesTotal / salesCount) : 0,
        byMethod,
        tips: round2(tipsTotal),
        byType
      },
      topDishes,
      topWaiters: {
        bySales: topWaitersBySales,
        byAverageTicket: topWaitersByAverage
      },
      margin:
        revenueWithRecipe > 0
          ? {
              revenueWithRecipe: round2(revenueWithRecipe),
              totalCost: round2(totalCost),
              gross: round2(revenueWithRecipe - totalCost),
              percent: round2(grossMarginPercent)
            }
          : null
    });
  } catch (error) {
    console.error('Error en GET /api/panel/daily:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
