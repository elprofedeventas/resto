/* RESTO — /api/cron/archive-old-orders
   Archiva órdenes y ventas con cierre/cancelación de hace más de 1 año en
   `monthlyArchive/{YYYY-MM}` (resumen comprimido) y borra los docs
   originales.

   Autorización:
     - Vercel Cron: header `Authorization: Bearer ${CRON_SECRET}`. Si
       coincide, ejecuta confirm sin dry-run (cron real en producción).
     - Manual (owner): session token + `?confirm=true`. Sin `confirm`,
       es dry-run (no toca nada, solo reporta).

   Configuración del cron en `web/vercel.json`. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getSession, getTokenFromRequest } from '../_lib/session.js';

const ARCHIVE_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 400;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isoYearMonth(timestamp) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function authorize(req, res) {
  const authHeader = req.headers.authorization || '';
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader === `Bearer ${secret}`) {
    return { kind: 'cron' };
  }
  const token = getTokenFromRequest(req);
  if (token) {
    const session = await getSession(token);
    if (session && session.role === 'owner') {
      return { kind: 'owner', session };
    }
  }
  res.status(401).json({ error: 'No autorizado' });
  return null;
}

function emptyByMethod() {
  return {
    cash: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    transfer: { count: 0, total: 0 },
    app: { count: 0, total: 0 }
  };
}

function computeMonthSummary(period, orders, sales) {
  const byMethod = emptyByMethod();
  const byType = { table: 0, takeout: 0, cancelled: 0 };
  const dishStats = new Map();
  const waiterStats = new Map();

  let salesCount = 0;
  let salesTotal = 0;
  let tipsTotal = 0;

  for (const sale of sales) {
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

    const wid = sale.waiterId;
    if (wid) {
      if (!waiterStats.has(wid)) {
        waiterStats.set(wid, {
          waiterId: wid,
          name: sale.waiterName || '',
          salesCount: 0,
          total: 0
        });
      }
      const w = waiterStats.get(wid);
      w.salesCount += 1;
      w.total += sale.totalToPay || 0;
    }

    if (Array.isArray(sale.items)) {
      for (const item of sale.items) {
        const did = item.dishId;
        if (!did) continue;
        if (!dishStats.has(did)) {
          dishStats.set(did, {
            dishId: did,
            name: item.dishName || '',
            quantity: 0,
            total: 0
          });
        }
        const d = dishStats.get(did);
        d.quantity += item.quantity || 0;
        d.total += (item.basePrice || 0) * (item.quantity || 0);
      }
    }
  }

  for (const o of orders) {
    if (o.status === 'cancelled') byType.cancelled += 1;
  }

  for (const m of Object.keys(byMethod)) {
    byMethod[m].total = round2(byMethod[m].total);
  }

  const topDishes = [...dishStats.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
    .map((d) => ({ ...d, total: round2(d.total) }));

  const topWaiters = [...waiterStats.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((w) => ({
      ...w,
      total: round2(w.total),
      average: w.salesCount > 0 ? round2(w.total / w.salesCount) : 0
    }));

  return {
    period,
    salesCount,
    salesTotal: round2(salesTotal),
    tipsTotal: round2(tipsTotal),
    byMethod,
    byType,
    topDishes,
    topWaiters,
    ordersCount: orders.length,
    archivedAt: Date.now()
  };
}

async function archiveLocale(db, restaurantRef, localeRef, cutoff, dryRun) {
  const [closedSnap, cancelledSnap] = await Promise.all([
    localeRef.collection('orders').where('closedAt', '<', cutoff).get(),
    localeRef.collection('orders').where('cancelledAt', '<', cutoff).get()
  ]);

  const ordersMap = new Map();
  for (const doc of closedSnap.docs) {
    ordersMap.set(doc.id, { id: doc.id, ...doc.data() });
  }
  for (const doc of cancelledSnap.docs) {
    if (!ordersMap.has(doc.id)) {
      ordersMap.set(doc.id, { id: doc.id, ...doc.data() });
    }
  }

  if (ordersMap.size === 0) {
    return { archivedMonths: [], deletedOrders: 0, deletedSales: 0 };
  }

  const salesSnap = await localeRef
    .collection('sales')
    .where('closedAt', '<', cutoff)
    .get();

  const ordersByMonth = new Map();
  for (const order of ordersMap.values()) {
    const ts = order.closedAt || order.cancelledAt;
    if (!ts) continue;
    const ym = isoYearMonth(ts);
    if (!ordersByMonth.has(ym)) ordersByMonth.set(ym, []);
    ordersByMonth.get(ym).push(order);
  }

  const salesByMonth = new Map();
  const salesById = new Map();
  for (const doc of salesSnap.docs) {
    const data = doc.data();
    const ym = isoYearMonth(data.closedAt);
    if (!salesByMonth.has(ym)) salesByMonth.set(ym, []);
    const sale = { id: doc.id, ...data };
    salesByMonth.get(ym).push(sale);
    salesById.set(doc.id, sale);
  }

  const archivedMonths = [];
  let deletedOrders = 0;
  let deletedSales = 0;

  for (const [ym, ordersInMonth] of ordersByMonth.entries()) {
    const salesInMonth = salesByMonth.get(ym) || [];
    const summary = computeMonthSummary(ym, ordersInMonth, salesInMonth);

    if (!dryRun) {
      await localeRef
        .collection('monthlyArchive')
        .doc(ym)
        .set(summary, { merge: true });

      let batch = db.batch();
      let count = 0;
      for (const o of ordersInMonth) {
        batch.delete(localeRef.collection('orders').doc(o.id));
        count += 1;
        deletedOrders += 1;
        if (count >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      for (const s of salesInMonth) {
        batch.delete(localeRef.collection('sales').doc(s.id));
        count += 1;
        deletedSales += 1;
        if (count >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    } else {
      deletedOrders += ordersInMonth.length;
      deletedSales += salesInMonth.length;
    }

    archivedMonths.push({
      period: ym,
      ordersCount: ordersInMonth.length,
      salesCount: salesInMonth.length,
      salesTotal: summary.salesTotal
    });
  }

  return { archivedMonths, deletedOrders, deletedSales };
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const auth = await authorize(req, res);
  if (!auth) return;

  const wantsConfirm = req.query?.confirm === 'true';
  const dryRun = auth.kind === 'cron' ? false : !wantsConfirm;

  const db = getDb();

  // El owner puede pasar `?cutoffMs=X` para testing manual.
  // El cron real siempre usa el default (1 año).
  let cutoff = Date.now() - ARCHIVE_AGE_MS;
  if (auth.kind === 'owner' && req.query?.cutoffMs) {
    const c = Number(req.query.cutoffMs);
    if (Number.isFinite(c) && c > 0) cutoff = c;
  }

  let restaurantIds = [];
  if (auth.kind === 'owner') {
    restaurantIds = [auth.session.restaurantId];
  } else {
    const snap = await db.collection('restaurants').get();
    restaurantIds = snap.docs.map((d) => d.id);
  }

  const results = [];

  try {
    for (const rid of restaurantIds) {
      const restaurantRef = db.collection('restaurants').doc(rid);
      const localesSnap = await restaurantRef.collection('locales').get();
      for (const localeDoc of localesSnap.docs) {
        const out = await archiveLocale(
          db,
          restaurantRef,
          localeDoc.ref,
          cutoff,
          dryRun
        );
        results.push({
          restaurantId: rid,
          localeId: localeDoc.id,
          ...out
        });
      }
    }

    return res.status(200).json({
      mode: dryRun ? 'dry-run' : 'confirmed',
      cutoffIso: new Date(cutoff).toISOString(),
      results
    });
  } catch (error) {
    console.error('Error en /api/cron/archive-old-orders:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
