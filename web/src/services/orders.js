/* RESTO — cliente del API de órdenes. */

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

export async function listOrders(token, localeId, status) {
  const params = new URLSearchParams({ localeId });
  if (status) params.set('status', status);
  const r = await fetch(`/api/orders?${params.toString()}`, {
    headers: buildHeaders(token)
  });
  const data = await parseOrThrow(r);
  return data.orders;
}

export async function getOrder(token, localeId, id) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(id)}?localeId=${encodeURIComponent(localeId)}`,
    { headers: buildHeaders(token) }
  );
  return parseOrThrow(r);
}

export async function createOrder(token, localeId, payload) {
  const r = await fetch('/api/orders', {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ ...payload, localeId })
  });
  return parseOrThrow(r);
}

export async function addOrderItem(token, localeId, orderId, item) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/items`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ ...item, localeId })
    }
  );
  return parseOrThrow(r);
}

export async function removeOrderItem(token, localeId, orderId, itemId) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}?localeId=${encodeURIComponent(localeId)}`,
    {
      method: 'DELETE',
      headers: buildHeaders(token)
    }
  );
  return parseOrThrow(r);
}

export async function sendOrderToKitchen(token, localeId, orderId) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/send-to-kitchen`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ localeId })
    }
  );
  return parseOrThrow(r);
}

export async function cancelOrder(token, localeId, orderId) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ localeId })
    }
  );
  return parseOrThrow(r);
}

export async function moveOrderItem(token, localeId, orderId, itemId, targetOrderId) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/move-item`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ localeId, itemId, targetOrderId })
    }
  );
  return parseOrThrow(r);
}

export async function addOrderCustomer(token, localeId, orderId, name) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/customers`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ localeId, name })
    }
  );
  return parseOrThrow(r);
}

export async function removeOrderCustomer(token, localeId, orderId, customerId) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/customers/${encodeURIComponent(customerId)}?localeId=${encodeURIComponent(localeId)}`,
    {
      method: 'DELETE',
      headers: buildHeaders(token)
    }
  );
  return parseOrThrow(r);
}

export async function assignOrderItem(token, localeId, orderId, itemId, customerId) {
  const r = await fetch(
    `/api/orders/${encodeURIComponent(orderId)}/items`,
    {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify({ localeId, itemId, customerId })
    }
  );
  return parseOrThrow(r);
}
