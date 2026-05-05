/* RESTO — /api/tables
   GET  ?localeId=X        → cualquier rol del local. Lista mesas.
   POST { localeId, ... }   → solo owner. Crea mesa. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { getLocaleId, requireSession } from '../_lib/requireSession.js';

function sanitize(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    number: data.number,
    x: typeof data.x === 'number' ? data.x : 0,
    y: typeof data.y === 'number' ? data.y : 0,
    capacity: typeof data.capacity === 'number' ? data.capacity : 4,
    shape: data.shape || 'square',
    active: data.active !== false,
    activeOrderId: data.activeOrderId || null,
    openedAt: data.openedAt || null
  };
}

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const localeId = getLocaleId(req, res, session);
  if (!localeId) return;

  const db = getDb();
  const ref = db
    .collection('restaurants').doc(session.restaurantId)
    .collection('locales').doc(localeId)
    .collection('tables');

  if (req.method === 'GET') {
    try {
      const snap = await ref.get();
      const tables = snap.docs.map(sanitize);
      return res.status(200).json({ tables });
    } catch (error) {
      console.error('Error en GET /api/tables:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'POST') {
    if (session.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { number, x, y, capacity } = req.body || {};

    if (typeof number !== 'string' || !number.trim()) {
      return res.status(400).json({ error: 'Número de mesa obligatorio.' });
    }
    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ error: 'Coordenadas inválidas.' });
    }
    if (typeof capacity !== 'number' || capacity <= 0) {
      return res.status(400).json({ error: 'Capacidad inválida.' });
    }

    try {
      const docRef = await ref.add({
        number: number.trim(),
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        capacity,
        shape: 'square',
        active: true,
        activeOrderId: null,
        openedAt: null,
        createdAt: Date.now()
      });
      const created = await docRef.get();
      return res.status(201).json(sanitize(created));
    } catch (error) {
      console.error('Error en POST /api/tables:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
