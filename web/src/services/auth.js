/* RESTO — cliente del servicio de autenticación.

   Habla solo con el backend (Vercel Functions). No conoce bcrypt ni Firestore. */

export async function login(pin) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin })
  });

  if (response.status === 401) {
    return { ok: false };
  }

  if (!response.ok) {
    throw new Error('No se pudo validar el PIN.');
  }

  const data = await response.json();
  return { ok: true, ...data };
}

export async function logout(token) {
  if (!token) return;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
  } catch (err) {
    // Logout es best-effort: si falla la red, igual limpiamos cliente.
  }
}
