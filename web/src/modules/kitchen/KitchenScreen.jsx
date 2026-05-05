/* RESTO — Pantalla de cocina (KDS).
   Muestra comandas con cronómetro vivo y semáforo de tiempos.
   Refresca automáticamente cada 10 segundos. */

import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getKitchenOrders, markItemReady } from '../../services/kitchen.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Select from '../../components/Select/Select.jsx';
import styles from './KitchenScreen.module.css';

const STATION_LABEL = {
  hot: 'Cocina caliente',
  cold: 'Cocina fría',
  bar: 'Bar'
};

const FILTER_OPTIONS = [
  { value: '', label: 'Mi estación' },
  { value: 'hot', label: 'Solo cocina caliente' },
  { value: 'cold', label: 'Solo cocina fría' },
  { value: 'bar', label: 'Solo bar' },
  { value: 'all', label: 'Todas' }
];

const REFRESH_INTERVAL_MS = 10 * 1000;
const SOFT_TICK_MS = 30 * 1000;

function elapsedFrom(timestamp) {
  if (!timestamp) return null;
  return Date.now() - timestamp;
}

function colorByElapsed(ms) {
  if (ms === null) return 'fresh';
  if (ms < 10 * 60 * 1000) return 'fresh';
  if (ms < 20 * 60 * 1000) return 'mid';
  return 'old';
}

function formatElapsed(ms) {
  if (ms === null) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  return `${h}h ${r}m`;
}

function describeOrder(o) {
  if (o.type === 'table') return `Mesa ${o.tableNumber || ''}`;
  return `Para llevar — ${o.takeoutName || 'sin nombre'}`;
}

function KitchenCard({ order, currency, token, localeId, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  // El sentToKitchenAt más antiguo de la card define su color.
  const oldest = order.items.reduce(
    (acc, it) =>
      it.sentToKitchenAt && (!acc || it.sentToKitchenAt < acc)
        ? it.sentToKitchenAt
        : acc,
    null
  );
  const elapsed = elapsedFrom(oldest);
  const color = colorByElapsed(elapsed);

  async function handleReady(itemId) {
    setError('');
    setBusyId(itemId);
    try {
      await markItemReady(token, localeId, order.id, itemId);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAllReady() {
    setError('');
    setBusyId('all');
    try {
      for (const it of order.items) {
        await markItemReady(token, localeId, order.id, it.id);
      }
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      padding="md"
      className={[styles.card, styles[`card_${color}`]]
        .filter(Boolean)
        .join(' ')}
    >
      <header className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>{describeOrder(order)}</h3>
          <p className={styles.cardMeta}>
            <span className={styles.orderNumber}>{order.orderNumber}</span> ·
            Mesero: {order.waiterName}
          </p>
        </div>
        <div className={styles.cardTimer}>
          {elapsed !== null ? formatElapsed(elapsed) : '—'}
        </div>
      </header>

      <ul className={styles.itemList}>
        {order.items.map((it) => (
          <li key={it.id} className={styles.itemRow}>
            <div className={styles.itemMain}>
              <span className={styles.itemQty}>×{it.quantity}</span>
              <div>
                <span className={styles.itemName}>{it.dishName}</span>
                <span className={styles.itemStation}>
                  {STATION_LABEL[it.station] || it.station}
                </span>
                {it.observations && (
                  <span className={styles.itemObs}>{it.observations}</span>
                )}
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => handleReady(it.id)}
              disabled={busyId !== null}
            >
              {busyId === it.id ? 'Marcando...' : '✓ Listo'}
            </Button>
          </li>
        ))}
      </ul>

      {error && <p className={styles.error}>{error}</p>}

      {order.items.length > 1 && (
        <div className={styles.cardActions}>
          <Button
            variant="secondary"
            onClick={handleAllReady}
            disabled={busyId !== null}
          >
            {busyId === 'all'
              ? 'Marcando todos...'
              : 'Marcar todo listo'}
          </Button>
        </div>
      )}
    </Card>
  );
}

function KitchenScreen({ onClose }) {
  const { token, activeLocaleId, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [activeStations, setActiveStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [tick, setTick] = useState(0);

  async function load() {
    try {
      setError('');
      const data = await getKitchenOrders(token, activeLocaleId, filter);
      setOrders(data.orders || []);
      setActiveStations(data.stations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocaleId, token, filter]);

  // Re-render para que el cronómetro avance.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), SOFT_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const stationsLabel = activeStations
    .map((s) => STATION_LABEL[s] || s)
    .join(' + ');

  return (
    <main className={styles.screen} data-tick={tick}>
      <header className={styles.header}>
        <div>
          <h1>Cocina</h1>
          <p className={styles.subtitle}>
            Local: {activeLocaleId} · Estaciones: {stationsLabel || '—'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Select
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            disabled={user.role === 'cook' || user.role === 'bar'}
          />
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
        </div>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {loading && <p className={styles.muted}>Cargando comandas...</p>}

      {!loading && orders.length === 0 && (
        <Card padding="lg" className={styles.empty}>
          <p>Sin comandas pendientes en este momento.</p>
        </Card>
      )}

      <section className={styles.grid}>
        {orders.map((o) => (
          <KitchenCard
            key={o.id}
            order={o}
            token={token}
            localeId={activeLocaleId}
            onChanged={load}
          />
        ))}
      </section>
    </main>
  );
}

export default KitchenScreen;
