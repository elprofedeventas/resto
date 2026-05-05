/* RESTO — POST /api/auth/logout
   Body: -
   Headers: Authorization: Bearer <token>
   Respuesta: 200 { ok: true }
   Idempotente: si el token no existe, igual responde ok. */

import '../_lib/loadEnv.js';
import { deleteSession, getTokenFromRequest } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const token = getTokenFromRequest(req);
  if (token) {
    try {
      await deleteSession(token);
    } catch (error) {
      console.error('Error en /api/auth/logout:', error);
    }
  }

  return res.status(200).json({ ok: true });
}
