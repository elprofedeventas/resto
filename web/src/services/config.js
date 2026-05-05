/* RESTO — cliente del API de configuración.
   Wrappers fetch sobre /api/restaurant, /api/locales y /api/users.
   Cada llamada incluye el token de sesión en el header Authorization. */

function buildHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseOrThrow(response) {
  if (response.ok) return response.json();
  let errMsg = `Error ${response.status}`;
  try {
    const data = await response.json();
    if (data && data.error) errMsg = data.error;
  } catch {
    // ignore
  }
  throw new Error(errMsg);
}

export async function getRestaurant(token) {
  const r = await fetch('/api/restaurant', { headers: buildHeaders(token) });
  return parseOrThrow(r);
}

export async function updateRestaurant(token, patch) {
  const r = await fetch('/api/restaurant', {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify(patch)
  });
  return parseOrThrow(r);
}

export async function getLocales(token) {
  const r = await fetch('/api/locales', { headers: buildHeaders(token) });
  const data = await parseOrThrow(r);
  return data.locales;
}

export async function updateLocale(token, id, patch) {
  const r = await fetch(`/api/locales/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify(patch)
  });
  return parseOrThrow(r);
}

export async function getUsers(token) {
  const r = await fetch('/api/users', { headers: buildHeaders(token) });
  const data = await parseOrThrow(r);
  return data.users;
}

export async function createUser(token, data) {
  const r = await fetch('/api/users', {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(data)
  });
  return parseOrThrow(r);
}

export async function updateUser(token, id, patch) {
  const r = await fetch(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify(patch)
  });
  return parseOrThrow(r);
}
