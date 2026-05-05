/* RESTO — middleware de validación de sesión y autorización por rol.

   Uso:
     const session = await requireSession(req, res);
     if (!session) return;                          // ya respondió 401

     const session = await requireSession(req, res, { role: 'owner' });
     if (!session) return;                          // ya respondió 401 o 403

     const session = await requireSession(req, res, { roles: ['owner', 'manager'] });

   Devuelve el objeto de sesión con: userId, restaurantId, role, name, localeIds.
   Si la sesión no existe, expiró, o el rol no aplica, ya escribió la respuesta
   y devuelve null para que el handler retorne. */

import { getSession, getTokenFromRequest } from './session.js';

export async function requireSession(req, res, options = {}) {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'No autenticado' });
    return null;
  }

  const session = await getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Sesión expirada o inválida' });
    return null;
  }

  if (options.role && session.role !== options.role) {
    res.status(403).json({ error: 'No autorizado' });
    return null;
  }

  if (options.roles && !options.roles.includes(session.role)) {
    res.status(403).json({ error: 'No autorizado' });
    return null;
  }

  return session;
}

/* Lee `localeId` de query (GET, DELETE) o body (POST, PATCH) y valida que la
   sesión tenga acceso al local. Devuelve el id si OK, o null tras escribir
   403 en la respuesta. */
export function getLocaleId(req, res, session) {
  const localeId =
    (req.query && req.query.localeId) ||
    (req.body && req.body.localeId) ||
    null;

  if (!localeId || typeof localeId !== 'string') {
    res.status(400).json({ error: 'localeId requerido.' });
    return null;
  }

  if (!Array.isArray(session.localeIds) || !session.localeIds.includes(localeId)) {
    res.status(403).json({ error: 'No tienes acceso a este local.' });
    return null;
  }

  return localeId;
}
