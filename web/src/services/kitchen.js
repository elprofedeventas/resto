/* RESTO — cliente del API de cocina (KDS). */

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

export async function getKitchenOrders(token, localeId, station) {
  const params = new URLSearchParams({ localeId });
  if (station) params.set('station', station);
  const r = await fetch(`/api/kitchen?${params.toString()}`, {
    headers: buildHeaders(token)
  });
  return parseOrThrow(r);
}

export async function markItemReady(token, localeId, orderId, itemId) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/ready`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ localeId })
    }
  );
  return parseOrThrow(r);
}
