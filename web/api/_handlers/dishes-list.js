/* RESTO — /api/dishes
   GET  → cualquier rol logueado. Lista platos con costo y margen calculados
          a partir de la receta + precio actual de los insumos.
   POST → solo owner. Crea plato (sin receta; la receta se guarda con PUT
          a /api/dishes/[id]/recipe). */

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

function sanitizeDish(doc, costInfo) {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    basePrice: typeof data.basePrice === 'number' ? data.basePrice : 0,
    category: data.category || '',
    station: data.station || 'hot',
    photoUrl: data.photoUrl || '',
    variants: Array.isArray(data.variants) ? data.variants : [],
    active: data.active !== false,
    cost: costInfo.cost,
    margin: costInfo.margin,
    hasRecipe: costInfo.hasRecipe
  };
}

function computeCost(recipeItems, ingredientsMap) {
  if (!recipeItems || recipeItems.length === 0) {
    return { cost: 0, hasRecipe: false };
  }
  let cost = 0;
  for (const item of recipeItems) {
    const ing = ingredientsMap.get(item.ingredientId);
    if (!ing) continue;
    cost += (ing.currentPrice || 0) * (item.quantity || 0);
  }
  return { cost, hasRecipe: true };
}

function computeMargin(basePrice, cost) {
  if (typeof basePrice !== 'number' || basePrice <= 0) return null;
  return (basePrice - cost) / basePrice;
}

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const db = getDb();
  const restaurantRef = db.collection('restaurants').doc(session.restaurantId);
  const dishesRef = restaurantRef.collection('menu');

  if (req.method === 'GET') {
    try {
      const [dishesSnap, ingredientsSnap, recipesSnap] = await Promise.all([
        dishesRef.get(),
        restaurantRef.collection('ingredients').get(),
        restaurantRef.collection('recipes').get()
      ]);

      const ingredientsMap = new Map();
      ingredientsSnap.docs.forEach((d) => {
        ingredientsMap.set(d.id, d.data());
      });

      const recipesMap = new Map();
      recipesSnap.docs.forEach((d) => {
        recipesMap.set(d.id, d.data().items || []);
      });

      const dishes = dishesSnap.docs.map((doc) => {
        const recipeItems = recipesMap.get(doc.id) || [];
        const { cost, hasRecipe } = computeCost(recipeItems, ingredientsMap);
        const margin = computeMargin(doc.data().basePrice, cost);
        return sanitizeDish(doc, { cost, margin, hasRecipe });
      });

      return res.status(200).json({ dishes });
    } catch (error) {
      console.error('Error en GET /api/dishes:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'POST') {
    if (session.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const body = req.body || {};
    const { name, basePrice, category, station, photoUrl, variants } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (typeof basePrice !== 'number' || basePrice < 0) {
      return res.status(400).json({ error: 'Precio base inválido.' });
    }
    if (typeof station !== 'string' || !VALID_STATIONS.includes(station)) {
      return res.status(400).json({ error: 'Estación inválida.' });
    }
    if (photoUrl !== undefined && !isValidPhotoUrl(photoUrl)) {
      return res.status(400).json({ error: 'photoUrl debe ser una URL http(s).' });
    }
    if (variants !== undefined && !isValidVariants(variants)) {
      return res.status(400).json({ error: 'Variantes inválidas.' });
    }

    try {
      const docRef = await dishesRef.add({
        name: name.trim(),
        basePrice,
        category: typeof category === 'string' ? category.trim() : '',
        station,
        photoUrl: typeof photoUrl === 'string' ? photoUrl : '',
        variants: Array.isArray(variants) ? variants : [],
        active: true,
        createdAt: Date.now()
      });
      const created = await docRef.get();
      return res.status(201).json(
        sanitizeDish(created, { cost: 0, margin: null, hasRecipe: false })
      );
    } catch (error) {
      console.error('Error en POST /api/dishes:', error);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
