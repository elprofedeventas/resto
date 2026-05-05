/* RESTO — cliente del API de carta (platos, insumos, recetas, overrides). */

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

// === Insumos ===

export async function getIngredients(token) {
  const r = await fetch('/api/ingredients', { headers: buildHeaders(token) });
  const data = await parseOrThrow(r);
  return data.ingredients;
}

export async function createIngredient(token, data) {
  const r = await fetch('/api/ingredients', {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(data)
  });
  return parseOrThrow(r);
}

export async function updateIngredient(token, id, patch) {
  const r = await fetch(`/api/ingredients/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify(patch)
  });
  return parseOrThrow(r);
}

// === Platos ===

export async function getDishes(token) {
  const r = await fetch('/api/dishes', { headers: buildHeaders(token) });
  const data = await parseOrThrow(r);
  return data.dishes;
}

export async function getDish(token, id) {
  const r = await fetch(`/api/dishes/${encodeURIComponent(id)}`, {
    headers: buildHeaders(token)
  });
  return parseOrThrow(r);
}

export async function createDish(token, data) {
  const r = await fetch('/api/dishes', {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(data)
  });
  return parseOrThrow(r);
}

export async function updateDish(token, id, patch) {
  const r = await fetch(`/api/dishes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify(patch)
  });
  return parseOrThrow(r);
}

export async function saveDishRecipe(token, id, items) {
  const r = await fetch(`/api/dishes/${encodeURIComponent(id)}/recipe`, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify({ items })
  });
  return parseOrThrow(r);
}

export async function setDishOverride(token, id, localeId, price) {
  const r = await fetch(`/api/dishes/${encodeURIComponent(id)}/overrides`, {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify({ localeId, price })
  });
  return parseOrThrow(r);
}
