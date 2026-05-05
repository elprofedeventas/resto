/* RESTO — POST /api/auth/login

   Body: { pin: "1234" }
   Respuestas:
     200 { token, user, locales }   → login OK
     400 { error }                  → PIN con formato inválido
     401 { error }                  → PIN no coincide
     500 { error }                  → error interno

   `locales` viene resuelto en una sola query (los locales activos del
   usuario), así el cliente evita un segundo round-trip. */

import '../_lib/loadEnv.js';
import bcrypt from 'bcryptjs';
import { getDb } from '../_lib/firebaseAdmin.js';
import { createSession } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const restaurantId = process.env.RESTAURANT_ID;
  if (!restaurantId) {
    console.error('RESTAURANT_ID no definido en el servidor.');
    return res.status(500).json({ error: 'Configuración de servidor incompleta.' });
  }

  const { pin } = req.body || {};
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN inválido' });
  }

  try {
    const db = getDb();
    const usersSnap = await db
      .collection('restaurants').doc(restaurantId)
      .collection('users')
      .where('active', '==', true)
      .get();

    let matched = null;
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (!data.pinHash) continue;
      const ok = await bcrypt.compare(pin, data.pinHash);
      if (ok) {
        matched = { id: doc.id, ...data };
        break;
      }
    }

    if (!matched) {
      return res.status(401).json({ error: 'PIN inválido' });
    }

    const userLocaleIds = Array.isArray(matched.localeIds) ? matched.localeIds : [];
    let locales = [];
    if (userLocaleIds.length > 0) {
      const localesSnap = await db
        .collection('restaurants').doc(restaurantId)
        .collection('locales')
        .where('active', '==', true)
        .get();

      locales = localesSnap.docs
        .filter((d) => userLocaleIds.includes(d.id))
        .map((d) => ({ id: d.id, name: d.data().name }));
    }

    const token = await createSession({
      userId: matched.id,
      restaurantId,
      role: matched.role,
      name: matched.name,
      localeIds: userLocaleIds
    });

    return res.status(200).json({
      token,
      user: {
        id: matched.id,
        name: matched.name,
        role: matched.role,
        localeIds: userLocaleIds
      },
      locales
    });
  } catch (error) {
    console.error('Error en /api/auth/login:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
