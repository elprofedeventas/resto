/* RESTO — /api/dishes/:id/recipe
   PUT → solo owner. Sobrescribe la receta entera del plato.
   Body: { items: [{ ingredientId, quantity }] }
   Si items es vacío, la receta queda sin items (costo 0). */

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
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : null;
  if (items === null) {
    return res.status(400).json({ error: 'items debe ser un array.' });
  }

  for (const item of items) {
    if (!item || typeof item.ingredientId !== 'string' || !item.ingredientId) {
      return res.status(400).json({ error: 'Cada item necesita ingredientId.' });
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      return res.status(400).json({ error: 'Cada item necesita quantity > 0.' });
    }
  }

  const db = getDb();
  const restaurantRef = db.collection('restaurants').doc(session.restaurantId);

  try {
    const dishSnap = await restaurantRef.collection('menu').doc(id).get();
    if (!dishSnap.exists) {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    if (items.length > 0) {
      const ingredientsSnap = await restaurantRef.collection('ingredients').get();
      const validIds = new Set(ingredientsSnap.docs.map((d) => d.id));
      for (const item of items) {
        if (!validIds.has(item.ingredientId)) {
          return res.status(400).json({
            error: `El insumo ${item.ingredientId} no existe.`
          });
        }
      }
    }

    const cleanItems = items.map((i) => ({
      ingredientId: i.ingredientId,
      quantity: i.quantity
    }));

    await restaurantRef.collection('recipes').doc(id).set({
      items: cleanItems,
      updatedAt: Date.now()
    });

    return res.status(200).json({ items: cleanItems });
  } catch (error) {
    console.error('Error en PUT /api/dishes/[id]/recipe:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
