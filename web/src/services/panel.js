/* RESTO — cliente del API del panel del dueño. */

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

export async function getDailyPanel(token, localeId, startMs, endMs, includeAll = false) {
  const params = new URLSearchParams({
    localeId,
    startMs: String(startMs),
    endMs: String(endMs)
  });
  if (includeAll) params.set('includeAll', '1');
  const r = await fetch(`/api/panel/daily?${params.toString()}`, {
    headers: buildHeaders(token)
  });
  return parseOrThrow(r);
}

export async function getPanelAlerts(token, localeId) {
  const params = new URLSearchParams({ localeId });
  const r = await fetch(`/api/panel/alerts?${params.toString()}`, {
    headers: buildHeaders(token)
  });
  return parseOrThrow(r);
}
