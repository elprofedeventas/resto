/* RESTO — /api/dishes/:id/overrides
   PATCH → solo owner. Setea o elimina el precio de un plato para un local.
   Body:
     { localeId, price }     → upsert override
     { localeId, price: null } → elimina override (vuelve al basePrice)
   Solo permitido si restaurant.settings.pricePerLocaleEnabled === true. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { requireSession } from '../_lib/requireSession.js';

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

  const { localeId, price } = req.body || {};
  if (typeof localeId !== 'string' || !localeId) {
    return res.status(400).json({ error: 'localeId requerido.' });
  }
  if (price !== null && (typeof price !== 'number' || price < 0)) {
    return res.status(400).json({ error: 'price debe ser número >= 0 o null.' });
  }

  const db = getDb();
  const restaurantRef = db.collection('restaurants').doc(session.restaurantId);

  try {
    const restaurantSnap = await restaurantRef.get();
    if (!restaurantSnap.exists) {
      return res.status(404).json({ error: 'Restaurante no encontrado.' });
    }
    const settings = restaurantSnap.data().settings || {};
    if (settings.pricePerLocaleEnabled !== true) {
      return res.status(400).json({
        error: 'El override de precio por local no está activado en la configuración.'
      });
    }

    const dishRef = restaurantRef.collection('menu').doc(id);
    const dishSnap = await dishRef.get();
    if (!dishSnap.exists) {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    const localeRef = restaurantRef.collection('locales').doc(localeId);
    const localeSnap = await localeRef.get();
    if (!localeSnap.exists) {
      return res.status(404).json({ error: 'Local no encontrado' });
    }

    const overrideRef = dishRef.collection('localOverrides').doc(localeId);

    if (price === null) {
      await overrideRef.delete();
      return res.status(200).json({ localeId, price: null });
    }

    await overrideRef.set({ price });
    return res.status(200).json({ localeId, price });
  } catch (error) {
    console.error('Error en PATCH /api/dishes/[id]/overrides:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
