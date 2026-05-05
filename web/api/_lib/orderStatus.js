/* RESTO — recálculo de status de orden a partir de los items.
   Usado tras agregar/quitar/mover items o marcar ready. */

export function computeStatus(items, currentStatus) {
  if (currentStatus === 'cancelled' || currentStatus === 'closed') {
    return currentStatus;
  }
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return 'open';
  const allReady = list.every((it) => it.kitchenStatus === 'ready');
  return allReady ? 'served' : 'open';
}
