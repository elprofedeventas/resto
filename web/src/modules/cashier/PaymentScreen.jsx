/* RESTO — Pantalla de cobro de una orden.
   Permite descuento (% o monto), propina, multi-pago, y emite recibo
   interno tras cerrar. */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getOrder } from '../../services/orders.js';
import { closeOrder } from '../../services/cashier.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Select from '../../components/Select/Select.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import { formatCurrency } from '../../utils/format.js';
import styles from './PaymentScreen.module.css';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'app', label: 'App de delivery' }
];

const METHOD_LABEL = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  app: 'App'
};

const TIP_DEFAULT_PCT = 10;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function describeOrder(o) {
  if (!o) return '';
  if (o.type === 'table') return `Mesa ${o.tableNumber || ''}`;
  return `Para llevar — ${o.takeoutName || 'sin nombre'}`;
}

function ReceiptModal({ isOpen, sale, currency, onClose }) {
  if (!sale) return null;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recibo interno"
      footer={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button variant="primary" onClick={onClose}>
            Cerrar
          </Button>
        </>
      }
    >
      <div className={styles.receipt}>
        <header className={styles.receiptHeader}>
          <h3>{describeOrder(sale)}</h3>
          <p className={styles.muted}>
            <span className={styles.mono}>{sale.saleNumber}</span> ·{' '}
            {new Date(sale.closedAt).toLocaleString('es-EC')}
          </p>
          <p className={styles.muted}>
            Mesero: {sale.waiterName} · Cajero: {sale.cashierName}
          </p>
        </header>

        <ul className={styles.receiptItems}>
          {sale.items.map((it) => (
            <li key={it.id} className={styles.receiptItem}>
              <span>
                ×{it.quantity} {it.dishName}
                {it.observations && (
                  <span className={styles.muted}> — {it.observations}</span>
                )}
              </span>
              <span>
                {formatCurrency(
                  (it.basePrice || 0) * (it.quantity || 0),
                  currency
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.receiptTotals}>
          <div className={styles.totalLine}>
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal, currency)}</span>
          </div>
          {sale.discount && (
            <div className={styles.totalLine}>
              <span>
                Descuento{' '}
                {sale.discount.type === 'percent'
                  ? `(${sale.discount.value}%)`
                  : '(monto)'}
              </span>
              <span>− {formatCurrency(sale.discount.applied, currency)}</span>
            </div>
          )}
          {sale.tip > 0 && (
            <div className={styles.totalLine}>
              <span>Propina</span>
              <span>{formatCurrency(sale.tip, currency)}</span>
            </div>
          )}
          <div className={[styles.totalLine, styles.totalLineMain].join(' ')}>
            <span>Total</span>
            <span>{formatCurrency(sale.totalToPay, currency)}</span>
          </div>
        </div>

        <ul className={styles.receiptPayments}>
          {sale.payments.map((p, i) => (
            <li key={i} className={styles.receiptPayment}>
              <span>{METHOD_LABEL[p.method] || p.method}</span>
              <span>{formatCurrency(p.amount, currency)}</span>
            </li>
          ))}
        </ul>

        {sale.change > 0 && (
          <div className={styles.totalLine}>
            <span>Vuelto</span>
            <span>{formatCurrency(sale.change, currency)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PaymentScreen({ orderId, currency, onClose }) {
  const { token, activeLocaleId } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // estado del formulario
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [tipPct, setTipPct] = useState(String(TIP_DEFAULT_PCT));
  const [tipAmount, setTipAmount] = useState('');
  const [payments, setPayments] = useState([
    { method: 'cash', amount: '', reference: '' }
  ]);

  const [saving, setSaving] = useState(false);
  const [sale, setSale] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const o = await getOrder(token, activeLocaleId, orderId);
        if (cancelled) return;
        setOrder(o);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, token, activeLocaleId]);

  const subtotal = order?.subtotal || 0;

  const discountApplied = useMemo(() => {
    if (!discountEnabled || !subtotal) return 0;
    const v = Number(discountValue);
    if (Number.isNaN(v) || v <= 0) return 0;
    if (discountType === 'percent') {
      return round2((subtotal * Math.min(v, 100)) / 100);
    }
    return round2(Math.min(v, subtotal));
  }, [discountEnabled, discountType, discountValue, subtotal]);

  const tipNum = useMemo(() => {
    if (tipAmount !== '') {
      const n = Number(tipAmount);
      return Number.isNaN(n) ? 0 : Math.max(0, round2(n));
    }
    const pct = Number(tipPct);
    if (Number.isNaN(pct)) return 0;
    return round2(((subtotal - discountApplied) * pct) / 100);
  }, [tipPct, tipAmount, subtotal, discountApplied]);

  const totalToPay = round2(Math.max(0, subtotal - discountApplied + tipNum));

  const totalPaid = useMemo(
    () =>
      round2(
        payments.reduce((s, p) => {
          const n = Number(p.amount);
          return s + (Number.isNaN(n) ? 0 : n);
        }, 0)
      ),
    [payments]
  );

  const change = round2(Math.max(0, totalPaid - totalToPay));
  const missing = round2(Math.max(0, totalToPay - totalPaid));

  function updatePayment(idx, field, value) {
    setPayments((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  }

  function addPayment() {
    setPayments((prev) => [
      ...prev,
      { method: 'card', amount: '', reference: '' }
    ]);
  }

  function removePayment(idx) {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
  }

  function fillRemainingOnPayment(idx) {
    const others = payments
      .filter((_, i) => i !== idx)
      .reduce((s, p) => {
        const n = Number(p.amount);
        return s + (Number.isNaN(n) ? 0 : n);
      }, 0);
    const remaining = round2(Math.max(0, totalToPay - others));
    updatePayment(idx, 'amount', String(remaining));
  }

  async function handleClose() {
    setError('');
    setSaving(true);
    try {
      const cleanPayments = payments
        .map((p) => ({
          method: p.method,
          amount: Number(p.amount) || 0,
          reference: p.reference || ''
        }))
        .filter((p) => p.amount > 0);

      if (cleanPayments.length === 0) {
        throw new Error('Debe registrar al menos un pago.');
      }

      const payload = {
        discount: discountEnabled
          ? {
              type: discountType,
              value: Number(discountValue) || 0
            }
          : null,
        tip: tipNum,
        payments: cleanPayments
      };

      const result = await closeOrder(token, activeLocaleId, orderId, payload);
      setSale(result.sale);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1>Cobrar — {describeOrder(order)}</h1>
          <p className={styles.subtitle}>
            <span className={styles.mono}>{order.orderNumber}</span> · Mesero:{' '}
            {order.waiterName}
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Volver
        </Button>
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <Card padding="lg" className={styles.section}>
        <h2>Items</h2>
        <ul className={styles.itemList}>
          {order.items.map((it) => (
            <li key={it.id} className={styles.itemRow}>
              <span>
                ×{it.quantity} {it.dishName}
                {it.observations && (
                  <span className={styles.muted}> — {it.observations}</span>
                )}
              </span>
              <span className={styles.itemPrice}>
                {formatCurrency(
                  (it.basePrice || 0) * (it.quantity || 0),
                  currency
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="lg" className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2>Descuento</h2>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(e) => setDiscountEnabled(e.target.checked)}
            />
            <span>Aplicar descuento</span>
          </label>
        </header>

        {discountEnabled && (
          <div className={styles.row}>
            <Select
              label="Tipo"
              options={[
                { value: 'percent', label: 'Porcentaje (%)' },
                { value: 'amount', label: `Monto (${currency})` }
              ]}
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            />
            <Input
              label={discountType === 'percent' ? 'Porcentaje' : `Monto (${currency})`}
              type="number"
              min="0"
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
        )}
      </Card>

      <Card padding="lg" className={styles.section}>
        <h2>Propina</h2>
        <p className={styles.muted}>
          Sugerido: 10% del subtotal después del descuento. Puedes editar el
          monto directo o el porcentaje.
        </p>
        <div className={styles.row}>
          <Input
            label="Porcentaje (%)"
            type="number"
            min="0"
            step="0.5"
            value={tipPct}
            onChange={(e) => {
              setTipPct(e.target.value);
              setTipAmount('');
            }}
          />
          <Input
            label={`Monto (${currency})`}
            type="number"
            min="0"
            step="0.01"
            placeholder={formatCurrency(tipNum, currency)}
            value={tipAmount}
            onChange={(e) => setTipAmount(e.target.value)}
          />
        </div>
      </Card>

      <Card padding="lg" className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2>Pagos</h2>
          <Button variant="secondary" onClick={addPayment}>
            Agregar pago
          </Button>
        </header>
        <div className={styles.paymentList}>
          {payments.map((p, idx) => (
            <div key={idx} className={styles.paymentRow}>
              <Select
                label={idx === 0 ? 'Método' : undefined}
                options={PAYMENT_METHODS}
                value={p.method}
                onChange={(e) => updatePayment(idx, 'method', e.target.value)}
              />
              <Input
                label={idx === 0 ? `Monto (${currency})` : undefined}
                type="number"
                min="0"
                step="0.01"
                value={p.amount}
                onChange={(e) => updatePayment(idx, 'amount', e.target.value)}
              />
              <Input
                label={idx === 0 ? 'Referencia (opcional)' : undefined}
                value={p.reference}
                onChange={(e) =>
                  updatePayment(idx, 'reference', e.target.value)
                }
              />
              <div className={styles.paymentActions}>
                <Button variant="ghost" onClick={() => fillRemainingOnPayment(idx)}>
                  Completar
                </Button>
                {payments.length > 1 && (
                  <Button variant="ghost" onClick={() => removePayment(idx)}>
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="lg" className={styles.totalsCard}>
        <h2>Totales</h2>
        <div className={styles.totalsList}>
          <div className={styles.totalLine}>
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          {discountEnabled && discountApplied > 0 && (
            <div className={styles.totalLine}>
              <span>Descuento</span>
              <span>− {formatCurrency(discountApplied, currency)}</span>
            </div>
          )}
          {tipNum > 0 && (
            <div className={styles.totalLine}>
              <span>Propina</span>
              <span>{formatCurrency(tipNum, currency)}</span>
            </div>
          )}
          <div className={[styles.totalLine, styles.totalMain].join(' ')}>
            <span>Total a pagar</span>
            <span>{formatCurrency(totalToPay, currency)}</span>
          </div>
          <div className={styles.totalLine}>
            <span>Pagado</span>
            <span>{formatCurrency(totalPaid, currency)}</span>
          </div>
          {missing > 0 && (
            <div className={[styles.totalLine, styles.missing].join(' ')}>
              <span>Falta</span>
              <span>{formatCurrency(missing, currency)}</span>
            </div>
          )}
          {change > 0 && (
            <div className={[styles.totalLine, styles.change].join(' ')}>
              <span>Vuelto</span>
              <span>{formatCurrency(change, currency)}</span>
            </div>
          )}
        </div>

        <div className={styles.bottomActions}>
          <Button
            variant="primary"
            onClick={handleClose}
            disabled={saving || missing > 0 || totalToPay <= 0}
          >
            {saving ? 'Cobrando...' : 'Cobrar y cerrar'}
          </Button>
        </div>
      </Card>

      <ReceiptModal
        isOpen={Boolean(sale)}
        sale={sale}
        currency={currency}
        onClose={() => {
          setSale(null);
          onClose();
        }}
      />
    </main>
  );
}

export default PaymentScreen;
