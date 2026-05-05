/* RESTO — Vista del salón. Plano visual + sección "para llevar".
   Cualquier rol del local puede ver. Owner, manager y waiter pueden tomar
   órdenes. */

import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getTables } from '../../services/tables.js';
import { createOrder, listOrders } from '../../services/orders.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import OrderEditor from './OrderEditor.jsx';
import styles from './FloorScreen.module.css';

const CAPACITY_SIZES = { 2: 60, 4: 80, 6: 100, 8: 120 };
const ROLES_THAT_TAKE_ORDERS = ['owner', 'manager', 'waiter'];
const REFRESH_INTERVAL_MS = 30 * 1000;

function tableSize(capacity) {
  return CAPACITY_SIZES[capacity] || 80;
}

function colorByElapsed(openedAt) {
  if (!openedAt) return 'libre';
  const elapsed = Date.now() - openedAt;
  const oneHour = 60 * 60 * 1000;
  if (elapsed < oneHour) return 'young';
  if (elapsed < 2 * oneHour) return 'mid';
  return 'old';
}

function formatElapsed(openedAt) {
  if (!openedAt) return '';
  const elapsed = Date.now() - openedAt;
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

function TakeoutModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setName('');
    setError('');
    onClose();
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      await onCreate(name.trim());
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Nueva orden para llevar"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Creando...' : 'Crear'}
          </Button>
        </>
      }
    >
      <Input
        label="Nombre o referencia (opcional)"
        placeholder="Cliente, número de pedido..."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {error && <p className={styles.error}>{error}</p>}
    </Modal>
  );
}

function FloorScreen({ onClose }) {
  const { token, activeLocaleId, user } = useAuth();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [takeoutOpen, setTakeoutOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const canTakeOrders = ROLES_THAT_TAKE_ORDERS.includes(user.role);

  async function load() {
    try {
      const [t, o] = await Promise.all([
        getTables(token, activeLocaleId),
        listOrders(token, activeLocaleId, ['open', 'served'])
      ]);
      setTables(t);
      setOrders(o);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const ordersById = new Map(orders.map((o) => [o.id, o]));

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocaleId, token]);

  // Re-render cada 30 s para que los colores y tiempos refresquen.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  async function handleOpenTable(table) {
    if (!canTakeOrders) return;
    if (table.activeOrderId) {
      setEditingOrderId(table.activeOrderId);
      return;
    }
    try {
      const order = await createOrder(token, activeLocaleId, {
        type: 'table',
        tableId: table.id
      });
      await load();
      setEditingOrderId(order.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateTakeout(name) {
    const order = await createOrder(token, activeLocaleId, {
      type: 'takeout',
      takeoutName: name
    });
    await load();
    setEditingOrderId(order.id);
  }

  function handleCloseEditor() {
    setEditingOrderId(null);
    load();
  }

  if (editingOrderId) {
    return (
      <OrderEditor orderId={editingOrderId} onClose={handleCloseEditor} />
    );
  }

  const takeoutOrders = orders.filter((o) => o.type === 'takeout');

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1>Salón</h1>
          <p className={styles.subtitle}>
            Local activo: {activeLocaleId}
          </p>
        </div>
        <div className={styles.headerActions}>
          {canTakeOrders && (
            <Button variant="primary" onClick={() => setTakeoutOpen(true)}>
              Nueva para llevar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.legend}>
        <span className={[styles.legendDot, styles.libre].join(' ')} />
        Libre
        <span className={[styles.legendDot, styles.young].join(' ')} />
        Recién abierta
        <span className={[styles.legendDot, styles.mid].join(' ')} />
        1–2 horas
        <span className={[styles.legendDot, styles.old].join(' ')} />
        Más de 2 horas
        <span className={[styles.legendDot, styles.served].join(' ')} />
        Por cobrar
      </section>

      <div className={styles.canvas} data-tick={tick}>
        {loading && <p className={styles.muted}>Cargando salón...</p>}
        {!loading && tables.length === 0 && (
          <p className={styles.canvasEmpty}>
            Aún no hay mesas en este local.
          </p>
        )}
        {!loading &&
          tables.map((t) => {
            const size = tableSize(t.capacity);
            const order = t.activeOrderId ? ordersById.get(t.activeOrderId) : null;
            const isServed = order && order.status === 'served';
            const color = !t.active
              ? 'inactive'
              : isServed
                ? 'served'
                : colorByElapsed(t.openedAt);
            const className = [
              styles.table,
              styles[color],
              !t.active ? styles.tableDisabled : ''
            ]
              .filter(Boolean)
              .join(' ');
            const occupied = Boolean(t.activeOrderId);
            return (
              <button
                key={t.id}
                type="button"
                className={className}
                style={{ left: t.x, top: t.y, width: size, height: size }}
                onClick={() => handleOpenTable(t)}
                disabled={!t.active || !canTakeOrders}
              >
                <span className={styles.tableNumber}>{t.number}</span>
                {occupied && (
                  <span className={styles.tableElapsed}>
                    {formatElapsed(t.openedAt)}
                  </span>
                )}
                {!occupied && t.active && (
                  <span className={styles.tableSubtitle}>libre</span>
                )}
              </button>
            );
          })}
      </div>

      {takeoutOrders.length > 0 && (
        <section className={styles.takeoutSection}>
          <h2>Para llevar abiertas ({takeoutOrders.length})</h2>
          <div className={styles.takeoutList}>
            {takeoutOrders.map((o) => (
              <Card
                key={o.id}
                padding="md"
                className={styles.takeoutCard}
                onClick={() => canTakeOrders && setEditingOrderId(o.id)}
              >
                <header className={styles.takeoutHeader}>
                  <span className={styles.takeoutLabel}>
                    {o.takeoutName || 'Sin nombre'}
                  </span>
                  <span className={styles.takeoutNumber}>{o.orderNumber}</span>
                </header>
                <p className={styles.muted}>
                  Mesero: {o.waiterName} · {o.items.length} item(s) · Hace{' '}
                  {formatElapsed(o.openedAt)}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <TakeoutModal
        isOpen={takeoutOpen}
        onClose={() => setTakeoutOpen(false)}
        onCreate={handleCreateTakeout}
      />
    </main>
  );
}

export default FloorScreen;
