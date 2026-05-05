/* RESTO — Panel del dueño. Dashboard del día por local con comparativos
   y vista consolidada multi-local. */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getLocales, getRestaurant } from '../../services/config.js';
import { getDailyPanel, getPanelAlerts } from '../../services/panel.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import { formatCurrency, formatPercent } from '../../utils/format.js';
import styles from './PanelScreen.module.css';

const METHOD_LABEL = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  app: 'App'
};

const COMPARISONS = [
  { id: 'none', label: 'Sin comparar' },
  { id: 'yesterday', label: 'vs. ayer' },
  { id: 'lastWeek', label: 'vs. semana pasada' },
  { id: 'lastMonth', label: 'vs. mes pasado' }
];

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function comparisonDate(dateStr, type) {
  const [y, m, d] = dateStr.split('-').map(Number);
  let prev;
  if (type === 'yesterday') prev = new Date(y, m - 1, d - 1);
  else if (type === 'lastWeek') prev = new Date(y, m - 1, d - 7);
  else if (type === 'lastMonth') prev = new Date(y, m - 2, d);
  else return null;
  return isoDate(prev);
}

function emptyByMethod() {
  return {
    cash: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    transfer: { count: 0, total: 0 },
    app: { count: 0, total: 0 }
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function consolidate(results) {
  if (results.length === 0) return null;

  let count = 0;
  let total = 0;
  let tips = 0;
  const byMethod = emptyByMethod();
  const byType = { table: 0, takeout: 0 };
  let revenueWithRecipe = 0;
  let totalCost = 0;
  const dishMap = new Map();
  const waiterMap = new Map();

  for (const r of results) {
    count += r.sales.count;
    total += r.sales.total;
    tips += r.sales.tips;
    byType.table += r.sales.byType.table;
    byType.takeout += r.sales.byType.takeout;

    for (const m of ['cash', 'card', 'transfer', 'app']) {
      byMethod[m].count += r.sales.byMethod[m].count;
      byMethod[m].total += r.sales.byMethod[m].total;
    }

    if (r.margin) {
      revenueWithRecipe += r.margin.revenueWithRecipe;
      totalCost += r.margin.totalCost;
    }

    for (const d of r.topDishes || []) {
      if (!dishMap.has(d.dishId)) {
        dishMap.set(d.dishId, {
          dishId: d.dishId,
          name: d.name,
          quantity: 0,
          total: 0
        });
      }
      const e = dishMap.get(d.dishId);
      e.quantity += d.quantity;
      e.total += d.total;
    }

    for (const w of r.topWaiters?.bySales || []) {
      if (!waiterMap.has(w.waiterId)) {
        waiterMap.set(w.waiterId, {
          waiterId: w.waiterId,
          name: w.name,
          salesCount: 0,
          total: 0
        });
      }
      const e = waiterMap.get(w.waiterId);
      e.salesCount += w.salesCount;
      e.total += w.total;
    }
  }

  for (const m of Object.keys(byMethod)) byMethod[m].total = round2(byMethod[m].total);

  const topDishes = [...dishMap.values()]
    .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
    .slice(0, 5)
    .map((d) => ({ ...d, total: round2(d.total) }));

  const waitersArr = [...waiterMap.values()];
  const topBySales = [...waitersArr]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((w) => ({ ...w, total: round2(w.total) }));
  const topByAverage = waitersArr
    .map((w) => ({
      ...w,
      average: w.salesCount > 0 ? round2(w.total / w.salesCount) : 0,
      total: round2(w.total)
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 3);

  return {
    sales: {
      count,
      total: round2(total),
      average: count > 0 ? round2(total / count) : 0,
      byMethod,
      tips: round2(tips),
      byType
    },
    topDishes,
    topWaiters: { bySales: topBySales, byAverageTicket: topByAverage },
    margin:
      revenueWithRecipe > 0
        ? {
            revenueWithRecipe: round2(revenueWithRecipe),
            totalCost: round2(totalCost),
            gross: round2(revenueWithRecipe - totalCost),
            percent: round2((revenueWithRecipe - totalCost) / revenueWithRecipe)
          }
        : null
  };
}

async function loadPanelForScope(token, localeIds, range) {
  if (localeIds.length === 1) {
    return await getDailyPanel(
      token,
      localeIds[0],
      range.startMs,
      range.endMs
    );
  }
  const results = await Promise.all(
    localeIds.map((id) =>
      getDailyPanel(token, id, range.startMs, range.endMs, true)
    )
  );
  return consolidate(results);
}

function mergeAlerts(results, localesById) {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0].data;

  const marginAtRiskMap = new Map();
  const delayedOrders = [];
  const cashDiscrepancies = [];
  let targetMargin = null;
  let thresholds = null;

  for (const r of results) {
    const a = r.data;
    if (targetMargin === null) targetMargin = a.targetMargin;
    if (thresholds === null) thresholds = a.thresholds;

    for (const m of a.marginAtRisk) {
      if (!marginAtRiskMap.has(m.dishId)) {
        marginAtRiskMap.set(m.dishId, m);
      }
    }
    const localeName = localesById.get(r.localeId)?.name || r.localeId;
    for (const o of a.delayedOrders) {
      delayedOrders.push({ ...o, localeId: r.localeId, localeName });
    }
    for (const c of a.cashDiscrepancies) {
      cashDiscrepancies.push({ ...c, localeId: r.localeId, localeName });
    }
  }

  return {
    targetMargin,
    thresholds,
    marginAtRisk: [...marginAtRiskMap.values()].sort(
      (a, b) => a.margin - b.margin
    ),
    delayedOrders: delayedOrders.sort((a, b) => b.elapsedMin - a.elapsedMin),
    cashDiscrepancies: cashDiscrepancies.sort((a, b) => b.closedAt - a.closedAt)
  };
}

async function loadAlertsForScope(token, localeIds, localesById) {
  const results = await Promise.all(
    localeIds.map(async (id) => ({
      localeId: id,
      data: await getPanelAlerts(token, id)
    }))
  );
  return mergeAlerts(results, localesById);
}

function DeltaBadge({ current, previous, format }) {
  if (previous == null) return null;
  if (previous === 0 && current === 0) {
    return <span className={styles.deltaMuted}>=</span>;
  }
  if (previous === 0) {
    return <span className={styles.deltaPositive}>nuevo</span>;
  }
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  const sign = diff > 0 ? '+' : '';
  let cls;
  if (diff === 0) cls = styles.deltaMuted;
  else if (diff > 0) cls = styles.deltaPositive;
  else cls = styles.deltaNegative;
  return (
    <span className={cls}>
      {sign}
      {format(diff)} ({sign}
      {pct.toFixed(1)}%)
    </span>
  );
}

function PanelScreen({ onClose }) {
  const { token, activeLocaleId, user } = useAuth();
  const userLocaleIds = useMemo(
    () => Array.isArray(user?.localeIds) ? user.localeIds : [activeLocaleId],
    [user?.localeIds, activeLocaleId]
  );
  const isMultiLocale = userLocaleIds.length > 1;

  const [date, setDate] = useState(() => isoDate(new Date()));
  const [comparison, setComparison] = useState('yesterday');
  const [scope, setScope] = useState(activeLocaleId); // localeId or 'all'
  const [data, setData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [locales, setLocales] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [r, l] = await Promise.all([getRestaurant(token), getLocales(token)]);
        if (!cancelled) {
          setRestaurant(r);
          setCurrency(r.currency || 'USD');
          setLocales(l || []);
        }
      } catch {
        // ignore
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const localesById = useMemo(() => {
    const map = new Map();
    for (const l of locales) map.set(l.id, l);
    return map;
  }, [locales]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const localeIds = scope === 'all' ? userLocaleIds : [scope];
        const current = dayRange(date);
        const prevDate = comparisonDate(date, comparison);

        const tasks = [
          loadPanelForScope(token, localeIds, current),
          loadAlertsForScope(token, localeIds, localesById)
        ];
        if (prevDate) {
          tasks.push(loadPanelForScope(token, localeIds, dayRange(prevDate)));
        }
        const [resCurrent, resAlerts, resPrev] = await Promise.all(tasks);
        if (cancelled) return;
        setData(resCurrent);
        setAlerts(resAlerts || null);
        setPrevData(resPrev || null);
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
  }, [token, scope, userLocaleIds, date, comparison, localesById]);

  const todayStr = useMemo(() => isoDate(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return isoDate(d);
  }, []);

  const fmtCurrency = (n) => formatCurrency(Math.abs(n), currency);
  const fmtCount = (n) => String(Math.abs(n));
  const fmtPercent = (n) => `${(Math.abs(n) * 100).toFixed(1)} pts`;

  const netResult = useMemo(() => {
    if (!data || !restaurant) return null;
    const monthlyPayroll = restaurant.settings?.monthlyPayroll || 0;
    const monthlyFixed = restaurant.settings?.monthlyFixedExpenses || 0;
    const dailyTotal = (monthlyPayroll + monthlyFixed) / 30;
    const activeLocales = locales.filter((l) => l.active !== false);
    const localesCount = activeLocales.length || 1;
    const allocatedDaily =
      scope === 'all' ? dailyTotal : dailyTotal / localesCount;
    const ingredientCost = data.margin?.totalCost || 0;
    const revenue = data.sales.total;
    const net = revenue - ingredientCost - allocatedDaily;
    const hasFixedExpenses = monthlyPayroll > 0 || monthlyFixed > 0;
    return {
      revenue,
      ingredientCost,
      allocatedDaily,
      payrollPart:
        scope === 'all' ? monthlyPayroll / 30 : monthlyPayroll / 30 / localesCount,
      fixedPart:
        scope === 'all'
          ? monthlyFixed / 30
          : monthlyFixed / 30 / localesCount,
      net,
      hasFixedExpenses,
      localesCount
    };
  }, [data, restaurant, locales, scope]);

  const scopeLabel = useMemo(() => {
    if (scope === 'all') return `Consolidado (${userLocaleIds.length} locales)`;
    const l = localesById.get(scope);
    return l ? l.name : scope;
  }, [scope, userLocaleIds, localesById]);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1>Panel</h1>
          <p className={styles.subtitle}>{scopeLabel}</p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant={date === yesterdayStr ? 'primary' : 'secondary'}
            onClick={() => setDate(yesterdayStr)}
          >
            Ayer
          </Button>
          <Button
            variant={date === todayStr ? 'primary' : 'secondary'}
            onClick={() => setDate(todayStr)}
          >
            Hoy
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
        </div>
      </header>

      {isMultiLocale && (
        <nav className={styles.compareNav}>
          <span className={styles.compareLabel}>Local:</span>
          {userLocaleIds.map((id) => {
            const l = localesById.get(id);
            return (
              <button
                key={id}
                type="button"
                className={[
                  styles.compareBtn,
                  scope === id ? styles.compareBtnActive : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setScope(id)}
              >
                {l ? l.name : id}
              </button>
            );
          })}
          <button
            type="button"
            className={[
              styles.compareBtn,
              scope === 'all' ? styles.compareBtnActive : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setScope('all')}
          >
            Consolidado
          </button>
        </nav>
      )}

      <nav className={styles.compareNav}>
        <span className={styles.compareLabel}>Comparar:</span>
        {COMPARISONS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={[
              styles.compareBtn,
              comparison === c.id ? styles.compareBtnActive : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setComparison(c.id)}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.muted}>Cargando métricas...</p>}

      {!loading && data && (
        <>
          <div className={styles.kpiRow}>
            <Card padding="md" className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Ventas</span>
              <span className={styles.kpiValue}>{data.sales.count}</span>
              <span className={styles.kpiSecondary}>
                {data.sales.byType.table} mesa · {data.sales.byType.takeout} para llevar
              </span>
              <DeltaBadge
                current={data.sales.count}
                previous={prevData?.sales.count}
                format={fmtCount}
              />
            </Card>
            <Card padding="md" className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Total cobrado</span>
              <span className={styles.kpiValue}>
                {formatCurrency(data.sales.total, currency)}
              </span>
              <span className={styles.kpiSecondary}>
                Ticket promedio {formatCurrency(data.sales.average, currency)}
              </span>
              <DeltaBadge
                current={data.sales.total}
                previous={prevData?.sales.total}
                format={fmtCurrency}
              />
            </Card>
            <Card padding="md" className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Propinas</span>
              <span className={styles.kpiValue}>
                {formatCurrency(data.sales.tips, currency)}
              </span>
              <DeltaBadge
                current={data.sales.tips}
                previous={prevData?.sales.tips}
                format={fmtCurrency}
              />
            </Card>
            <Card padding="md" className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Margen bruto</span>
              <span className={styles.kpiValue}>
                {data.margin ? formatPercent(data.margin.percent) : '—'}
              </span>
              <span className={styles.kpiSecondary}>
                {data.margin
                  ? `Costo ${formatCurrency(data.margin.totalCost, currency)} de ${formatCurrency(data.margin.revenueWithRecipe, currency)} con receta`
                  : 'Sin recetas activas'}
              </span>
              {data.margin && prevData?.margin && (
                <DeltaBadge
                  current={data.margin.percent}
                  previous={prevData.margin.percent}
                  format={fmtPercent}
                />
              )}
            </Card>
          </div>

          {netResult && (
            <Card padding="lg" className={styles.section}>
              <header className={styles.alertsHeader}>
                <h2>¿Cuánto te quedó limpio?</h2>
                <p className={styles.muted}>
                  Estimación: ventas − costo de insumos consumidos − parte
                  prorrateada de nómina y servicios fijos (mensual / 30
                  {scope !== 'all'
                    ? ` / ${netResult.localesCount} locales activos`
                    : ''}
                  ).
                </p>
              </header>

              <div className={styles.netGrid}>
                <div className={styles.netLine}>
                  <span>Ventas</span>
                  <span className={styles.netPositive}>
                    {formatCurrency(netResult.revenue, currency)}
                  </span>
                </div>
                <div className={styles.netLine}>
                  <span>Costo de insumos</span>
                  <span className={styles.netNegative}>
                    − {formatCurrency(netResult.ingredientCost, currency)}
                  </span>
                </div>
                <div className={styles.netLine}>
                  <span>Nómina prorrateada</span>
                  <span className={styles.netNegative}>
                    − {formatCurrency(netResult.payrollPart, currency)}
                  </span>
                </div>
                <div className={styles.netLine}>
                  <span>Servicios fijos prorrateados</span>
                  <span className={styles.netNegative}>
                    − {formatCurrency(netResult.fixedPart, currency)}
                  </span>
                </div>
                <div
                  className={[
                    styles.netLine,
                    styles.netLineMain,
                    netResult.net >= 0 ? styles.netOk : styles.netDanger
                  ].join(' ')}
                >
                  <span>Neto del día</span>
                  <span>{formatCurrency(netResult.net, currency)}</span>
                </div>
              </div>

              {!netResult.hasFixedExpenses && (
                <p className={styles.muted}>
                  Configura tu nómina mensual y servicios fijos en
                  Configuración → Restaurante para un cálculo completo.
                </p>
              )}
            </Card>
          )}

          {alerts && (
            <Card padding="lg" className={styles.section}>
              <header className={styles.alertsHeader}>
                <h2>Alertas</h2>
                <p className={styles.muted}>
                  Margen objetivo {formatPercent(alerts.targetMargin)} · Demora &gt;
                  {alerts.thresholds?.kitchenDelayMinutes} min · Caja últimos{' '}
                  {alerts.thresholds?.shiftLookbackDays} días
                </p>
              </header>

              <div className={styles.alertsGrid}>
                <div className={styles.alertBlock}>
                  <h3 className={styles.subTitle}>
                    Margen en riesgo ({alerts.marginAtRisk.length})
                  </h3>
                  {alerts.marginAtRisk.length === 0 ? (
                    <p className={styles.muted}>Todos los platos sobre el objetivo.</p>
                  ) : (
                    <ul className={styles.alertList}>
                      {alerts.marginAtRisk.slice(0, 8).map((m) => (
                        <li key={m.dishId} className={styles.alertRow}>
                          <span className={styles.alertName}>{m.name}</span>
                          <span className={styles.alertSecondary}>
                            costo {formatCurrency(m.cost, currency)} de{' '}
                            {formatCurrency(m.basePrice, currency)}
                          </span>
                          <span className={styles.alertValueDanger}>
                            {formatPercent(m.margin)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={styles.alertBlock}>
                  <h3 className={styles.subTitle}>
                    Comandas demoradas ({alerts.delayedOrders.length})
                  </h3>
                  {alerts.delayedOrders.length === 0 ? (
                    <p className={styles.muted}>Sin demoras en cocina.</p>
                  ) : (
                    <ul className={styles.alertList}>
                      {alerts.delayedOrders.slice(0, 8).map((o) => (
                        <li key={o.orderId} className={styles.alertRow}>
                          <span className={styles.alertName}>
                            {o.type === 'table'
                              ? `Mesa ${o.tableNumber || ''}`
                              : `Para llevar — ${o.takeoutName || 'sin nombre'}`}
                            {o.localeName && (
                              <span className={styles.alertScope}>
                                {' · '}
                                {o.localeName}
                              </span>
                            )}
                          </span>
                          <span className={styles.alertSecondary}>
                            {o.delayedCount} item(s) · mesero {o.waiterName}
                          </span>
                          <span className={styles.alertValueDanger}>
                            {o.elapsedMin} min
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={styles.alertBlock}>
                  <h3 className={styles.subTitle}>
                    Diferencias de caja ({alerts.cashDiscrepancies.length})
                  </h3>
                  {alerts.cashDiscrepancies.length === 0 ? (
                    <p className={styles.muted}>Cuadres sin diferencia.</p>
                  ) : (
                    <ul className={styles.alertList}>
                      {alerts.cashDiscrepancies.slice(0, 8).map((c) => (
                        <li key={c.shiftId} className={styles.alertRow}>
                          <span className={styles.alertName}>
                            {new Date(c.closedAt).toLocaleDateString('es-EC')} ·{' '}
                            {c.closedByName}
                            {c.localeName && (
                              <span className={styles.alertScope}>
                                {' · '}
                                {c.localeName}
                              </span>
                            )}
                          </span>
                          <span className={styles.alertSecondary}>
                            decl. {formatCurrency(c.closingCash, currency)} ·{' '}
                            esp. {formatCurrency(c.expectedCash, currency)}
                          </span>
                          <span
                            className={
                              c.diff > 0
                                ? styles.alertValueOver
                                : styles.alertValueDanger
                            }
                          >
                            {c.diff > 0 ? '+' : ''}
                            {formatCurrency(c.diff, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          )}

          <Card padding="lg" className={styles.section}>
            <h2>Pagos por método</h2>
            <div className={styles.byMethodGrid}>
              {Object.entries(data.sales.byMethod).map(([m, t]) => (
                <div key={m} className={styles.methodCell}>
                  <span className={styles.methodLabel}>{METHOD_LABEL[m]}</span>
                  <span className={styles.methodTotal}>
                    {formatCurrency(t.total, currency)}
                  </span>
                  <span className={styles.muted}>{t.count} pago(s)</span>
                </div>
              ))}
            </div>
          </Card>

          <div className={styles.twoCol}>
            <Card padding="lg" className={styles.section}>
              <h2>Plato estrella · Top 5</h2>
              {data.topDishes.length === 0 ? (
                <p className={styles.muted}>Sin ventas en este rango.</p>
              ) : (
                <ul className={styles.rankList}>
                  {data.topDishes.map((d, i) => (
                    <li key={d.dishId} className={styles.rankRow}>
                      <span className={styles.rankPosition}>#{i + 1}</span>
                      <span className={styles.rankName}>{d.name}</span>
                      <span className={styles.rankSecondary}>
                        ×{d.quantity}
                      </span>
                      <span className={styles.rankValue}>
                        {formatCurrency(d.total, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card padding="lg" className={styles.section}>
              <h2>Top meseros</h2>
              <div className={styles.subSection}>
                <h3 className={styles.subTitle}>Por ventas totales</h3>
                {data.topWaiters.bySales.length === 0 ? (
                  <p className={styles.muted}>—</p>
                ) : (
                  <ul className={styles.rankList}>
                    {data.topWaiters.bySales.map((w, i) => (
                      <li key={w.waiterId} className={styles.rankRow}>
                        <span className={styles.rankPosition}>#{i + 1}</span>
                        <span className={styles.rankName}>{w.name}</span>
                        <span className={styles.rankSecondary}>
                          {w.salesCount} venta(s)
                        </span>
                        <span className={styles.rankValue}>
                          {formatCurrency(w.total, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={styles.subSection}>
                <h3 className={styles.subTitle}>Por ticket promedio</h3>
                {data.topWaiters.byAverageTicket.length === 0 ? (
                  <p className={styles.muted}>—</p>
                ) : (
                  <ul className={styles.rankList}>
                    {data.topWaiters.byAverageTicket.map((w, i) => (
                      <li key={w.waiterId} className={styles.rankRow}>
                        <span className={styles.rankPosition}>#{i + 1}</span>
                        <span className={styles.rankName}>{w.name}</span>
                        <span className={styles.rankSecondary}>
                          {w.salesCount} venta(s)
                        </span>
                        <span className={styles.rankValue}>
                          {formatCurrency(w.average, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}

export default PanelScreen;
