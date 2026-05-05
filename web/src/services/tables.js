/* RESTO — cliente del API de mesas. */

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

export async function getTables(token, localeId) {
  const r = await fetch(
    `/api/tables?localeId=${encodeURIComponent(localeId)}`,
    { headers: buildHeaders(token) }
  );
  const data = await parseOrThrow(r);
  return data.tables;
}

export async function createTable(token, localeId, data) {
  const r = await fetch('/api/tables', {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ ...data, localeId })
  });
  return parseOrThrow(r);
}

export async function updateTable(token, localeId, id, patch) {
  const r = await fetch(`/api/tables/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify({ ...patch, localeId })
  });
  return parseOrThrow(r);
}

export async function deleteTable(token, localeId, id) {
  const r = await fetch(
    `/api/tables/${encodeURIComponent(id)}?localeId=${encodeURIComponent(localeId)}`,
    {
      method: 'DELETE',
      headers: buildHeaders(token)
    }
  );
  return parseOrThrow(r);
}
