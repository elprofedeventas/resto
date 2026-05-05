/* RESTO — cliente del API de caja. */

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

export async function closeOrder(token, localeId, orderId, payload) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/close`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ ...payload, localeId })
    }
  );
  return parseOrThrow(r);
}
