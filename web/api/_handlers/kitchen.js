/* RESTO — /api/kitchen
   GET ?localeId=X[&station=hot|cold|bar|all]
       → devuelve las órdenes con al menos un item en kitchen del filtro.
       Cada orden trae solo los items con kitchenStatus='kitchen' que
       coinciden con la estación.
       El filtro por defecto depende del rol:
         cook → hot + cold
         bar → bar
         owner, manager → todas
       Cualquier rol puede pasar `station` explícitamente. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

const VALID_STATIONS = ['hot', 'cold', 'bar'];

function defaultStations(role) {
  if (role === 'cook') return ['hot', 'cold'];
  if (role === 'bar') return ['bar'];
  return VALID_STATIONS;
}

function parseStation(raw, fallback) {
  if (!raw || raw === 'all') return fallback;
  if (typeof raw === 'string' && VALID_STATIONS.includes(raw)) return [raw];
  return fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const stations = parseStation(req.query?.station, defaultStations(session.role));

  const db = getDb();
  const ordersRef = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId)
    .collection('orders');

  try {
    const snap = await ordersRef.where('status', '==', 'open').get();
    const stationSet = new Set(stations);

    const result = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      const items = Array.isArray(data.items) ? data.items : [];
      const filtered = items.filter(
        (it) => it.kitchenStatus === 'kitchen' && stationSet.has(it.station)
      );
      if (filtered.length === 0) continue;
      result.push({
        id: doc.id,
        orderNumber: data.orderNumber,
        type: data.type,
        tableId: data.tableId || null,
        tableNumber: data.tableNumber || null,
        takeoutName: data.takeoutName || null,
        waiterName: data.waiterName,
        openedAt: data.openedAt || null,
        status: data.status,
        items: filtered.map((it) => ({
          id: it.id,
          dishName: it.dishName,
          station: it.station,
          quantity: it.quantity,
          observations: it.observations || '',
          kitchenStatus: it.kitchenStatus,
          sentToKitchenAt: it.sentToKitchenAt || null
        }))
      });
    }

    result.sort(
      (a, b) =>
        (a.items[0]?.sentToKitchenAt || 0) -
        (b.items[0]?.sentToKitchenAt || 0)
    );

    return res.status(200).json({ orders: result, stations });
  } catch (error) {
    console.error('Error en GET /api/kitchen:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
