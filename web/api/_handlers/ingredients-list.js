/* RESTO — /api/ingredients
   GET  → cualquier rol logueado. Lista insumos.
   POST → solo owner. Crea insumo. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { requireSession } from '../_lib/requireSession.js';

const VALID_UNITS = ['kg', 'g', 'l', 'ml', 'unidad'];

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
  const session = await requireSession(req, res);
  if (!session) return;

  const db = getDb();
  const ref = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('ingredients');

  if (req.method === 'GET') {
    try {
      const snap = await ref.get();
      const ingredients = snap.docs.map(sanitize);
      return res.status(200).json({ ingredients });
    } catch (error) {
      console.error('Error en GET /api/ingredients:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'POST') {
    if (session.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { name, unit, currentPrice, supplier } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (typeof unit !== 'string' || !VALID_UNITS.includes(unit)) {
      return res.status(400).json({ error: 'Unidad inválida.' });
    }
    if (typeof currentPrice !== 'number' || currentPrice < 0) {
      return res.status(400).json({ error: 'Precio inválido.' });
    }

    try {
      const now = Date.now();
      const docRef = await ref.add({
        name: name.trim(),
        unit,
        currentPrice,
        supplier: typeof supplier === 'string' ? supplier.trim() : '',
        priceHistory: [{ price: currentPrice, date: now }],
        active: true,
        createdAt: now
      });
      const created = await docRef.get();
      return res.status(201).json(sanitize(created));
    } catch (error) {
      console.error('Error en POST /api/ingredients:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
