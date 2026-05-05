/* RESTO — /api/dishes/:id
   GET   → cualquier rol logueado. Detalle con receta expandida y overrides.
   PATCH → solo owner. Edita campos base del plato. */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { requireSession } from '../_lib/requireSession.js';

const VALID_STATIONS = ['hot', 'cold', 'bar'];

function isValidVariants(variants) {
  if (!Array.isArray(variants)) return false;
  return variants.every(
    (v) =>
      v &&
      typeof v.name === 'string' &&
      v.name.trim() &&
      typeof v.basePrice === 'number' &&
      v.basePrice >= 0
  );
}

function isValidPhotoUrl(url) {
  if (typeof url !== 'string') return false;
  if (url === '') return true;
  return /^https?:\/\//.test(url);
}

function computeMargin(basePrice, cost) {
  if (typeof basePrice !== 'number' || basePrice <= 0) return null;
  return (basePrice - cost) / basePrice;
}

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const db = getDb();
  const restaurantRef = db.collection('restaurants').doc(session.restaurantId);
  const dishRef = restaurantRef.collection('menu').doc(id);

  if (req.method === 'GET') {
    try {
      const snap = await dishRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Plato no encontrado' });
      }
      const data = snap.data();

      const [recipeSnap, overridesSnap, ingredientsSnap] = await Promise.all([
        restaurantRef.collection('recipes').doc(id).get(),
        dishRef.collection('localOverrides').get(),
        restaurantRef.collection('ingredients').get()
      ]);

      const ingredientsMap = new Map();
      ingredientsSnap.docs.forEach((d) => {
        ingredientsMap.set(d.id, { id: d.id, ...d.data() });
      });

      const rawItems = recipeSnap.exists ? recipeSnap.data().items || [] : [];
      let totalCost = 0;
      const items = rawItems.map((item) => {
        const ing = ingredientsMap.get(item.ingredientId);
        const lineCost = ing
          ? (ing.currentPrice || 0) * (item.quantity || 0)
          : 0;
        totalCost += lineCost;
        return {
          ingredientId: item.ingredientId,
          ingredientName: ing ? ing.name : '(insumo eliminado)',
          unit: ing ? ing.unit : '',
          currentPrice: ing ? ing.currentPrice : 0,
          quantity: item.quantity,
          lineCost
        };
      });

      const localOverrides = overridesSnap.docs.map((d) => ({
        localeId: d.id,
        price: d.data().price
      }));

      return res.status(200).json({
        id: snap.id,
        name: data.name,
        basePrice: data.basePrice || 0,
        category: data.category || '',
        station: data.station || 'hot',
        photoUrl: data.photoUrl || '',
        variants: Array.isArray(data.variants) ? data.variants : [],
        active: data.active !== false,
        recipe: {
          items,
          totalCost,
          hasRecipe: items.length > 0
        },
        margin: computeMargin(data.basePrice, totalCost),
        localOverrides
      });
    } catch (error) {
      console.error('Error en GET /api/dishes/[id]:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'PATCH') {
    if (session.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const body = req.body || {};
    const update = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim();
    }
    if (typeof body.basePrice === 'number' && body.basePrice >= 0) {
      update.basePrice = body.basePrice;
    }
    if (typeof body.category === 'string') {
      update.category = body.category.trim();
    }
    if (typeof body.station === 'string') {
      if (!VALID_STATIONS.includes(body.station)) {
        return res.status(400).json({ error: 'Estación inválida.' });
      }
      update.station = body.station;
    }
    if (body.photoUrl !== undefined) {
      if (!isValidPhotoUrl(body.photoUrl)) {
        return res.status(400).json({ error: 'photoUrl debe ser una URL http(s).' });
      }
      update.photoUrl = body.photoUrl;
    }
    if (body.variants !== undefined) {
      if (!isValidVariants(body.variants)) {
        return res.status(400).json({ error: 'Variantes inválidas.' });
      }
      update.variants = body.variants;
    }
    if (typeof body.active === 'boolean') {
      update.active = body.active;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Sin cambios válidos' });
    }

    try {
      const snap = await dishRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Plato no encontrado' });
      }
      await dishRef.update(update);
      const updated = await dishRef.get();
      const data = updated.data();
      return res.status(200).json({
        id: updated.id,
        name: data.name,
        basePrice: data.basePrice || 0,
        category: data.category || '',
        station: data.station || 'hot',
        photoUrl: data.photoUrl || '',
        variants: Array.isArray(data.variants) ? data.variants : [],
        active: data.active !== false
      });
    } catch (error) {
      console.error('Error en PATCH /api/dishes/[id]:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
