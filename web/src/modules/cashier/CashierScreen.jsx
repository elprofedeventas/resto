/* RESTO — Vista de caja. Panel de turno arriba (abrir/cerrar) y lista de
   cuentas pendientes abajo. */

import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getRestaurant } from '../../services/config.js';
import { listOrders } from '../../services/orders.js';
import {
  closeShift,
  getCurrentShift,
  openShift
} from '../../services/shifts.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import { formatCurrency } from '../../utils/format.js';
import PaymentScreen from './PaymentScreen.jsx';
import styles from './CashierScreen.module.css';

const REFRESH_INTERVAL_MS = 15 * 1000;

const METHOD_LABEL = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  app: 'App'
};

function describeOrder(o) {
  if (o.type === 'table') return `Mesa ${o.tableNumber || ''}`;
  return `Para llevar — ${o.takeoutName || 'sin nombre'}`;
}

function formatElapsed(timestamp) {
  if (!timestamp) return '—';
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  return `${h}h ${r}m`;
}

function formatTime(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('es-EC');
}

function OpenShiftCard({ onOpened }) {
  const { token, activeLocaleId } = useAuth();
  const [openingCash, setOpeningCash] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleOpen() {
    setError('');
    const cash = Number(openingCash);
    if (Number.isNaN(cash) || cash < 0) {
      setError('Efectivo inicial inválido.');
      return;
    }
    setSaving(true);
    try {
      const shift = await openShift(token, activeLocaleId, cash);
      onOpened(shift);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg" className={styles.shiftCard}>
      <header className={styles.shiftHeader}>
        <div>
          <h2>Turno cerrado</h2>
          <p className={styles.muted}>
            No hay un turno abierto en este local. Abre uno declarando el
            efectivo inicial en la caja.
          </p>
        </div>
      </header>
      <div className={styles.openShiftForm}>
        <Input
          label="Efectivo inicial"
          type="number"
          min="0"
          step="0.01"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
        />
        <Button
          variant="primary"
          onClick={handleOpen}
          disabled={saving || openingCash === ''}
        >
          {saving ? 'Abriendo...' : 'Abrir turno'}
        </Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </Card>
  );
}

function CloseShiftModal({ isOpen, onClose, shift, currency, onClosed }) {
  const { token, activeLocaleId } = useAuth();
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [closedShift, setClosedShift] = useState(null);

  function close() {
    setClosingCash('');
    setNotes('');
    setError('');
    setClosedShift(null);
    onClose();
  }

  async function handleSave() {
    setError('');
    const cash = Number(closingCash);
    if (Number.isNaN(cash) || cash < 0) {
      setError('Efectivo declarado inválido.');
      return;
    }
    setSaving(true);
    try {
      const result = await closeShift(token, activeLocaleId, shift.id, cash, notes);
      setClosedShift(result);
      onClosed();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!shift) return null;

  if (closedShift) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={close}
        title="Turno cerrado"
        footer={
          <Button variant="primary" onClick={close}>
            Cerrar
          </Button>
        }
      >
        <div className={styles.closedSummary}>
          <p className={styles.muted}>
            Cerrado por {closedShift.closedByName} el{' '}
            {formatTime(closedShift.closedAt)}.
          </p>
          <div className={styles.summaryLine}>
            <span>Efectivo declarado</span>
            <span>{formatCurrency(closedShift.closingCash, currency)}</span>
          </div>
          <div className={styles.summaryLine}>
            <span>Efectivo teórico</span>
            <span>{formatCurrency(closedShift.expectedCash, currency)}</span>
          </div>
          <div
            className={[
              styles.summaryLine,
              styles.summaryLineMain,
              closedShift.diff === 0
                ? styles.summaryOk
                : closedShift.diff > 0
                  ? styles.summaryOver
                  : styles.summaryShort
            ].join(' ')}
          >
            <span>Diferencia</span>
            <span>{formatCurrency(closedShift.diff, currency)}</span>
          </div>
          {closedShift.diff === 0 && (
            <p className={styles.muted}>Cuadre perfecto.</p>
          )}
          {closedShift.diff > 0 && (
            <p className={styles.muted}>Sobra efectivo respecto al teórico.</p>
          )}
          {closedShift.diff < 0 && (
            <p className={styles.muted}>Falta efectivo respecto al teórico.</p>
          )}
        </div>
      </Modal>
    );
  }

  const expected = shift.expectedCash || 0;
  const cashNum = Number(closingCash);
  const diff =
    closingCash === '' || Number.isNaN(cashNum)
      ? null
      : Math.round((cashNum - expected) * 100) / 100;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Cerrar turno"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || closingCash === ''}
          >
            {saving ? 'Cerrando...' : 'Cerrar turno'}
          </Button>
        </>
      }
    >
      <div className={styles.modalForm}>
        <div className={styles.preCloseStats}>
          <div className={styles.summaryLine}>
            <span>Efectivo inicial</span>
            <span>{formatCurrency(shift.openingCash, currency)}</span>
          </div>
          <div className={styles.summaryLine}>
            <span>Cobrado en efectivo</span>
            <span>
              {formatCurrency(
                shift.totals?.payments?.cash?.total || 0,
                currency
              )}
            </span>
          </div>
          <div className={styles.summaryLine}>
            <span>Vueltos entregados</span>
            <span>− {formatCurrency(shift.totals?.totalChange || 0, currency)}</span>
          </div>
          <div className={[styles.summaryLine, styles.summaryLineMain].join(' ')}>
            <span>Efectivo teórico</span>
            <span>{formatCurrency(expected, currency)}</span>
          </div>
        </div>

        <Input
          label={`Efectivo declarado (${currency})`}
          type="number"
          min="0"
          step="0.01"
          value={closingCash}
          onChange={(e) => setClosingCash(e.target.value)}
        />

        {diff !== null && (
          <div
            className={[
              styles.summaryLine,
              diff === 0
                ? styles.summaryOk
                : diff > 0
                  ? styles.summaryOver
                  : styles.summaryShort
            ].join(' ')}
          >
            <span>Diferencia</span>
            <span>{formatCurrency(diff, currency)}</span>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Notas (opcional)</label>
          <textarea
            className={styles.textarea}
            rows={2}
            placeholder="Observaciones del cierre..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Modal>
  );
}

function OpenShiftSummary({ shift, currency, onCloseShift }) {
  const totals = shift.totals || {
    salesCount: 0,
    payments: {
      cash: { total: 0 },
      card: { total: 0 },
      transfer: { total: 0 },
      app: { total: 0 }
    },
    totalSales: 0,
    totalChange: 0,
    totalTips: 0
  };

  return (
    <Card padding="lg" className={styles.shiftCard}>
      <header className={styles.shiftHeader}>
        <div>
          <h2>Turno abierto</h2>
          <p className={styles.muted}>
            Desde {formatTime(shift.openedAt)} · Abrió: {shift.openedByName}
          </p>
        </div>
        <Button variant="primary" onClick={onCloseShift}>
          Cerrar turno
        </Button>
      </header>

      <div className={styles.shiftStatsRow}>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>Ventas</span>
          <span className={styles.statValue}>{totals.salesCount}</span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>Total cobrado</span>
          <span className={styles.statValue}>
            {formatCurrency(totals.totalSales, currency)}
          </span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>Propinas</span>
          <span className={styles.statValue}>
            {formatCurrency(totals.totalTips, currency)}
          </span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>Efectivo teórico</span>
          <span className={styles.statValue}>
            {formatCurrency(shift.expectedCash || 0, currency)}
          </span>
        </div>
      </div>

      <div className={styles.byMethodRow}>
        {['cash', 'card', 'transfer', 'app'].map((m) => {
          const t = totals.payments?.[m] || { count: 0, total: 0 };
          return (
            <div key={m} className={styles.methodCell}>
              <span className={styles.methodLabel}>{METHOD_LABEL[m]}</span>
              <span className={styles.methodTotal}>
                {formatCurrency(t.total, currency)}
              </span>
              <span className={styles.muted}>{t.count} pago(s)</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function CashierScreen({ onClose }) {
  const { token, activeLocaleId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [shift, setShift] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [tick, setTick] = useState(0);

  async function load() {
    try {
      setError('');
      const [list, current] = await Promise.all([
        listOrders(token, activeLocaleId, ['open', 'served']),
        getCurrentShift(token, activeLocaleId)
      ]);
      setOrders(list);
      setShift(current);
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
        const r = await getRestaurant(token);
        if (!cancelled) setCurrency(r.currency || 'USD');
      } catch {
        // ignore
      }
    }
    init();
    setLoading(true);
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLocaleId, token]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (paying) {
    return (
      <PaymentScreen
        orderId={paying}
        currency={currency}
        onClose={() => {
          setPaying(null);
          load();
        }}
      />
    );
  }

  return (
    <main className={styles.screen} data-tick={tick}>
      <header className={styles.header}>
        <div>
          <h1>Caja</h1>
          <p className={styles.subtitle}>Local: {activeLocaleId}</p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Volver
        </Button>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.muted}>Cargando...</p>
      ) : shift ? (
        <OpenShiftSummary
          shift={shift}
          currency={currency}
          onCloseShift={() => setCloseOpen(true)}
        />
      ) : (
        <OpenShiftCard onOpened={() => load()} />
      )}

      <h2 className={styles.sectionTitle}>Cuentas pendientes</h2>

      {!loading && orders.length === 0 && (
        <Card padding="lg" className={styles.empty}>
          <p>Sin cuentas pendientes.</p>
        </Card>
      )}

      <section className={styles.list}>
        {orders.map((o) => {
          const ready = o.status === 'served';
          return (
            <Card
              key={o.id}
              padding="md"
              className={[styles.orderCard, ready ? styles.orderReady : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => setPaying(o.id)}
            >
              <header className={styles.orderHeader}>
                <div>
                  <h3 className={styles.orderTitle}>{describeOrder(o)}</h3>
                  <p className={styles.orderMeta}>
                    <span className={styles.orderNumber}>{o.orderNumber}</span> ·
                    Mesero: {o.waiterName} · {o.items.length} item(s) · Hace{' '}
                    {formatElapsed(o.openedAt)}
                  </p>
                </div>
                <div className={styles.orderRight}>
                  <span
                    className={[
                      styles.statusBadge,
                      ready ? styles.statusReady : styles.statusOpen
                    ].join(' ')}
                  >
                    {ready ? 'Lista para cobrar' : 'En curso'}
                  </span>
                  <span className={styles.orderTotal}>
                    {formatCurrency(o.subtotal, currency)}
                  </span>
                </div>
              </header>
            </Card>
          );
        })}
      </section>

      <CloseShiftModal
        isOpen={closeOpen}
        onClose={() => setCloseOpen(false)}
        shift={shift}
        currency={currency}
        onClosed={load}
      />
    </main>
  );
}

export default CashierScreen;
