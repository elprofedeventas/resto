/* RESTO — /api/ingredients/:id
   PATCH → solo owner. Edita name, unit, currentPrice, supplier, active.
   Si currentPrice cambia, el precio anterior se mueve a priceHistory
   (manteniendo solo los últimos 10 cambios). */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { requireSession } from '../_lib/requireSession.js';

const VALID_UNITS = ['kg', 'g', 'l', 'ml', 'unidad'];
const PRICE_HISTORY_LIMIT = 10;

function sanitize(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    unit: data.unit,
    currentPrice: typeof data.currentPrice === 'number' ? data.currentPrice : 0,
    supplier: data.supplier || '',
    priceHistory: Array.isArray(data.priceHistory) ? data.priceHistory : [],
    active: data.active !== false
  };
}

export default async function handler(req, res) {
  const session = await requireSession(req, res, { role: 'owner' });
  if (!session) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' });
  }
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const db = getDb();
  const ref = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('ingredients').doc(id);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    const current = snap.data();
    const body = req.body || {};
    const update = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim();
    }
    if (typeof body.unit === 'string') {
      if (!VALID_UNITS.includes(body.unit)) {
        return res.status(400).json({ error: 'Unidad inválida.' });
      }
      update.unit = body.unit;
    }
    if (typeof body.supplier === 'string') {
      update.supplier = body.supplier.trim();
    }
    if (typeof body.active === 'boolean') {
      update.active = body.active;
    }

    if (typeof body.currentPrice === 'number' && body.currentPrice >= 0) {
      if (body.currentPrice !== current.currentPrice) {
        update.currentPrice = body.currentPrice;
        const history = Array.isArray(current.priceHistory)
          ? current.priceHistory.slice()
          : [];
        history.push({ price: body.currentPrice, date: Date.now() });
        const trimmed = history.slice(-PRICE_HISTORY_LIMIT);
        update.priceHistory = trimmed;
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Sin cambios válidos' });
    }

    await ref.update(update);
    const updated = await ref.get();
    return res.status(200).json(sanitize(updated));
  } catch (error) {
    console.error('Error en PATCH /api/ingredients/[id]:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
