/* RESTO — Editor de orden activa.
   Permite agregar items desde la carta, observaciones libres por item,
   enviar a cocina, mover items, gestionar comensales y dividir cuenta. */

import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getRestaurant } from '../../services/config.js';
import { getDishes } from '../../services/menu.js';
import {
  addOrderCustomer,
  addOrderItem,
  assignOrderItem,
  cancelOrder,
  getOrder,
  listOrders,
  moveOrderItem,
  removeOrderCustomer,
  removeOrderItem,
  sendOrderToKitchen
} from '../../services/orders.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import { formatCurrency } from '../../utils/format.js';
import styles from './OrderEditor.module.css';

const KITCHEN_LABEL = {
  pending: 'Pendiente',
  kitchen: 'En cocina',
  ready: 'Listo'
};

const CANCEL_ROLES = ['owner', 'manager', 'waiter'];

function AddItemModal({
  isOpen,
  onClose,
  dishes,
  currency,
  onAdd,
  loadingDishes
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setSearch('');
    setSelectedId(null);
    setQuantity(1);
    setObservations('');
    setError('');
    onClose();
  }

  async function handleSave() {
    setError('');
    if (!selectedId) {
      setError('Selecciona un plato.');
      return;
    }
    if (quantity <= 0) {
      setError('Cantidad inválida.');
      return;
    }
    setSaving(true);
    try {
      await onAdd({ dishId: selectedId, quantity, observations });
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = dishes
    .filter((d) => d.active)
    .filter((d) =>
      search ? d.name.toLowerCase().includes(search.toLowerCase()) : true
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Agregar plato"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !selectedId}
          >
            {saving ? 'Agregando...' : 'Agregar'}
          </Button>
        </>
      }
    >
      <div className={styles.modalForm}>
        <Input
          label="Buscar plato"
          placeholder="Nombre del plato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loadingDishes ? (
          <p className={styles.muted}>Cargando carta...</p>
        ) : (
          <div className={styles.dishList}>
            {filtered.length === 0 && (
              <p className={styles.muted}>No hay platos disponibles.</p>
            )}
            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                className={[
                  styles.dishOption,
                  selectedId === d.id ? styles.dishOptionSelected : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedId(d.id)}
              >
                <span className={styles.dishOptionName}>{d.name}</span>
                <span className={styles.dishOptionPrice}>
                  {formatCurrency(d.basePrice, currency)}
                </span>
              </button>
            ))}
          </div>
        )}

        <Input
          label="Cantidad"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />

        <div className={styles.field}>
          <label className={styles.label}>Observaciones</label>
          <textarea
            className={styles.textarea}
            rows={2}
            placeholder="Sin sal, sin cebolla, término medio..."
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Modal>
  );
}

function CancelConfirmModal({ isOpen, onClose, onConfirm, saving }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancelar orden"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            No, mantener
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={saving}>
            {saving ? 'Cancelando...' : 'Sí, cancelar'}
          </Button>
        </>
      }
    >
      <p>
        Esto anula la orden por completo. Si era una mesa, la mesa queda libre.
        ¿Continuar?
      </p>
    </Modal>
  );
}

function MoveItemModal({
  isOpen,
  onClose,
  item,
  currentOrderId,
  token,
  localeId,
  onConfirmed
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelectedTarget(null);
    listOrders(token, localeId, 'open')
      .then((list) => {
        if (cancelled) return;
        setOrders(list.filter((o) => o.id !== currentOrderId));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, token, localeId, currentOrderId]);

  function close() {
    setSelectedTarget(null);
    setError('');
    onClose();
  }

  async function handleConfirm() {
    if (!selectedTarget || !item) return;
    setError('');
    setSaving(true);
    try {
      await onConfirmed(item.id, selectedTarget);
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function describeOrder(o) {
    if (o.type === 'table') return `Mesa ${o.tableNumber || ''}`;
    return `Para llevar — ${o.takeoutName || 'sin nombre'}`;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={item ? `Mover "${item.dishName}"` : 'Mover item'}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={saving || !selectedTarget}
          >
            {saving ? 'Moviendo...' : 'Mover'}
          </Button>
        </>
      }
    >
      <div className={styles.modalForm}>
        <p className={styles.muted}>
          Selecciona la orden destino. El item conserva su estado actual de
          cocina.
        </p>

        {loading && <p className={styles.muted}>Cargando órdenes...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && orders.length === 0 && (
          <p className={styles.muted}>
            No hay otras órdenes abiertas para recibir este item.
          </p>
        )}

        {!loading && orders.length > 0 && (
          <div className={styles.dishList}>
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                className={[
                  styles.dishOption,
                  selectedTarget === o.id ? styles.dishOptionSelected : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedTarget(o.id)}
              >
                <span className={styles.dishOptionName}>
                  {describeOrder(o)}
                </span>
                <span className={styles.dishOptionPrice}>{o.orderNumber}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CustomersPanel({ customers, token, localeId, orderId, onChange }) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    setError('');
    if (!name.trim()) {
      setError('Nombre obligatorio.');
      return;
    }
    setAdding(true);
    try {
      await addOrderCustomer(token, localeId, orderId, name);
      setName('');
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(customerId) {
    setError('');
    try {
      await removeOrderCustomer(token, localeId, orderId, customerId);
      await onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card padding="lg" className={styles.customersCard}>
      <header className={styles.itemsHeader}>
        <h2>Comensales ({customers.length})</h2>
      </header>
      <p className={styles.muted}>
        Asigna items a comensales para dividir la cuenta. Lo no asignado queda
        como "general".
      </p>

      <div className={styles.addCustomerForm}>
        <Input
          placeholder="Nombre del comensal"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <Button
          variant="primary"
          onClick={handleAdd}
          disabled={adding || !name.trim()}
        >
          {adding ? 'Agregando...' : 'Agregar'}
        </Button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {customers.length > 0 && (
        <ul className={styles.customerList}>
          {customers.map((c) => (
            <li key={c.id} className={styles.customerRow}>
              <span className={styles.customerName}>{c.name}</span>
              <Button variant="ghost" onClick={() => handleRemove(c.id)}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PerCustomerSummary({ customers, items, currency }) {
  const generalItems = items.filter((i) => !i.customerId);
  const generalTotal = generalItems.reduce(
    (s, i) => s + (i.basePrice || 0) * (i.quantity || 0),
    0
  );

  const rows = customers.map((c) => {
    const cItems = items.filter((i) => i.customerId === c.id);
    const total = cItems.reduce(
      (s, i) => s + (i.basePrice || 0) * (i.quantity || 0),
      0
    );
    return { id: c.id, name: c.name, count: cItems.length, total };
  });

  return (
    <Card padding="lg" className={styles.summaryCard}>
      <h2>Resumen por comensal</h2>
      <ul className={styles.summaryList}>
        <li className={styles.summaryRow}>
          <span>
            General <span className={styles.summaryCount}>({generalItems.length} item)</span>
          </span>
          <span className={styles.summaryAmount}>
            {formatCurrency(generalTotal, currency)}
          </span>
        </li>
        {rows.map((r) => (
          <li key={r.id} className={styles.summaryRow}>
            <span>
              {r.name} <span className={styles.summaryCount}>({r.count} item)</span>
            </span>
            <span className={styles.summaryAmount}>
              {formatCurrency(r.total, currency)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OrderEditor({ orderId, onClose }) {
  const { token, activeLocaleId, user } = useAuth();
  const [order, setOrder] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [loadingDishes, setLoadingDishes] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [movingItem, setMovingItem] = useState(null);

  async function reloadOrder() {
    try {
      const o = await getOrder(token, activeLocaleId, orderId);
      setOrder(o);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [r, d] = await Promise.all([
          getRestaurant(token),
          getDishes(token)
        ]);
        if (!cancelled) {
          setCurrency(r.currency || 'USD');
          setDishes(d);
        }
      } catch {
        // los flujos manejan error propio
      } finally {
        if (!cancelled) setLoadingDishes(false);
      }
    }
    init();
    reloadOrder();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  async function handleAdd(item) {
    setError('');
    setInfo('');
    await addOrderItem(token, activeLocaleId, orderId, item);
    await reloadOrder();
  }

  async function handleRemove(itemId) {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await removeOrderItem(token, activeLocaleId, orderId, itemId);
      await reloadOrder();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendToKitchen() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const result = await sendOrderToKitchen(token, activeLocaleId, orderId);
      setInfo(`Enviado a cocina: ${result.sent} item(s).`);
      await reloadOrder();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await cancelOrder(token, activeLocaleId, orderId);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
      setCancelOpen(false);
    }
  }

  async function handleMove(itemId, targetOrderId) {
    setError('');
    setInfo('');
    await moveOrderItem(token, activeLocaleId, orderId, itemId, targetOrderId);
    setInfo('Item movido.');
    await reloadOrder();
  }

  async function handleAssign(itemId, customerId) {
    setError('');
    setInfo('');
    try {
      await assignOrderItem(token, activeLocaleId, orderId, itemId, customerId);
      await reloadOrder();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <main className={styles.screen}>
        <p className={styles.muted}>Cargando orden...</p>
      </main>
    );
  }
  if (!order) {
    return (
      <main className={styles.screen}>
        <p className={styles.error}>{error || 'Orden no disponible.'}</p>
        <Button variant="secondary" onClick={onClose}>
          Volver
        </Button>
      </main>
    );
  }

  const pendingCount = order.items.filter(
    (i) => i.kitchenStatus === 'pending'
  ).length;
  const canCancel =
    CANCEL_ROLES.includes(user.role) &&
    (user.role !== 'waiter' || order.waiterId === user.id);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1>
            {order.type === 'table'
              ? `Mesa ${order.tableNumber || ''}`
              : `Para llevar — ${order.takeoutName || 'sin nombre'}`}
          </h1>
          <p className={styles.subtitle}>
            <span className={styles.orderNumber}>{order.orderNumber}</span> ·
            Mesero: {order.waiterName}
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Volver al salón
        </Button>
      </header>

      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.success}>{info}</p>}

      <CustomersPanel
        customers={order.customers || []}
        token={token}
        localeId={activeLocaleId}
        orderId={orderId}
        onChange={reloadOrder}
      />

      <Card padding="lg" className={styles.itemsCard}>
        <header className={styles.itemsHeader}>
          <h2>Items ({order.items.length})</h2>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            Agregar plato
          </Button>
        </header>

        {order.items.length === 0 ? (
          <p className={styles.muted}>
            La orden todavía no tiene items. Agrega platos desde la carta.
          </p>
        ) : (
          <ul className={styles.itemList}>
            {order.items.map((it) => {
              const lineTotal = (it.basePrice || 0) * (it.quantity || 0);
              return (
                <li key={it.id} className={styles.itemRow}>
                  <div className={styles.itemMain}>
                    <span className={styles.itemQty}>×{it.quantity}</span>
                    <div className={styles.itemBody}>
                      <span className={styles.itemName}>{it.dishName}</span>
                      <span
                        className={[
                          styles.itemStatus,
                          styles[`status_${it.kitchenStatus}`]
                        ].join(' ')}
                      >
                        {KITCHEN_LABEL[it.kitchenStatus] || it.kitchenStatus}
                      </span>
                      {it.observations && (
                        <span className={styles.itemObs}>{it.observations}</span>
                      )}
                      <div className={styles.itemAssign}>
                        <label className={styles.itemAssignLabel}>
                          Asignado a:
                        </label>
                        <select
                          className={styles.itemAssignSelect}
                          value={it.customerId || ''}
                          onChange={(e) =>
                            handleAssign(it.id, e.target.value || null)
                          }
                        >
                          <option value="">— general —</option>
                          {(order.customers || []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={styles.itemPrice}>
                      {formatCurrency(lineTotal, currency)}
                    </span>
                    <div className={styles.itemActions}>
                      <Button
                        variant="ghost"
                        onClick={() => setMovingItem(it)}
                        disabled={busy}
                      >
                        Mover
                      </Button>
                      {it.kitchenStatus === 'pending' && (
                        <Button
                          variant="ghost"
                          onClick={() => handleRemove(it.id)}
                          disabled={busy}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className={styles.totals}>
          <span>Subtotal</span>
          <span className={styles.totalValue}>
            {formatCurrency(order.subtotal, currency)}
          </span>
        </div>
      </Card>

      {(order.customers || []).length > 0 && (
        <PerCustomerSummary
          customers={order.customers}
          items={order.items}
          currency={currency}
        />
      )}

      <div className={styles.bottomActions}>
        {canCancel && (
          <Button variant="ghost" onClick={() => setCancelOpen(true)}>
            Cancelar orden
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleSendToKitchen}
          disabled={busy || pendingCount === 0}
        >
          {pendingCount > 0
            ? `Enviar a cocina (${pendingCount})`
            : 'Sin items para enviar'}
        </Button>
      </div>

      <AddItemModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        dishes={dishes}
        currency={currency}
        onAdd={handleAdd}
        loadingDishes={loadingDishes}
      />

      <CancelConfirmModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        saving={busy}
      />

      <MoveItemModal
        isOpen={Boolean(movingItem)}
        onClose={() => setMovingItem(null)}
        item={movingItem}
        currentOrderId={orderId}
        token={token}
        localeId={activeLocaleId}
        onConfirmed={handleMove}
      />
    </main>
  );
}

export default OrderEditor;
