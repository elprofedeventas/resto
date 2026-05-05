/* RESTO — cliente del API de turnos. */

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

export async function listShifts(token, localeId, status) {
  const params = new URLSearchParams({ localeId });
  if (status) params.set('status', status);
  const r = await fetch(`/api/shifts?${params.toString()}`, {
    headers: buildHeaders(token)
  });
  const data = await parseOrThrow(r);
  return data.shifts;
}

export async function getCurrentShift(token, localeId) {
  const r = await fetch(
    `/api/shifts/current?localeId=${encodeURIComponent(localeId)}`,
    { headers: buildHeaders(token) }
  );
  const data = await parseOrThrow(r);
  return data.shift;
}

export async function getShift(token, localeId, id) {
  const r = await fetch(
    `/api/shifts/${encodeURIComponent(id)}?localeId=${encodeURIComponent(localeId)}`,
    { headers: buildHeaders(token) }
  );
  return parseOrThrow(r);
}

export async function openShift(token, localeId, openingCash, notes) {
  const r = await fetch('/api/shifts', {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ localeId, openingCash, notes })
  });
  return parseOrThrow(r);
}

export async function closeShift(token, localeId, id, closingCash, notes) {
  const r = await fetch(
    `/api/shifts/${encodeURIComponent(id)}/close`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ localeId, closingCash, notes })
    }
  );
  return parseOrThrow(r);
}
