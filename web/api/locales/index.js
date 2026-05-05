/* RESTO — /api/locales
   GET → cualquier usuario logueado. Devuelve solo los locales asignados a la
         sesión (para owner que tiene todos, devuelve los 4). */

import '../_lib/loadEnv.js';
import { getDb } from '../_lib/firebaseAdmin.js';
import { requireSession } from '../_lib/requireSession.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const db = getDb();
    const snap = await db
      .collection('restaurants').doc(session.restaurantId)
      .collection('locales')
      .get();

    const allowed = new Set(session.localeIds || []);
    const list = snap.docs
      .filter((d) => allowed.has(d.id))
      .map((d) => ({ id: d.id, ...d.data() }));

    return res.status(200).json({ locales: list });
  } catch (error) {
    console.error('Error en GET /api/locales:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
