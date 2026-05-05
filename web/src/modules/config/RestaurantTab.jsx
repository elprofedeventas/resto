import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getRestaurant, updateRestaurant } from '../../services/config.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Select from '../../components/Select/Select.jsx';
import Toggle from '../../components/Toggle/Toggle.jsx';
import styles from './RestaurantTab.module.css';

const CURRENCIES = [
  { value: 'USD', label: 'USD — dólar estadounidense' },
  { value: 'EUR', label: 'EUR — euro' },
  { value: 'COP', label: 'COP — peso colombiano' },
  { value: 'MXN', label: 'MXN — peso mexicano' },
  { value: 'PEN', label: 'PEN — sol peruano' },
  { value: 'CLP', label: 'CLP — peso chileno' },
  { value: 'ARS', label: 'ARS — peso argentino' }
];

const TIMEZONES = [
  { value: 'America/Guayaquil', label: 'Ecuador (Guayaquil)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' }
];

function RestaurantTab() {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/Guayaquil');
  const [marginPct, setMarginPct] = useState('60');
  const [pricePerLocale, setPricePerLocale] = useState(false);
  const [monthlyPayroll, setMonthlyPayroll] = useState('');
  const [monthlyFixedExpenses, setMonthlyFixedExpenses] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await getRestaurant(token);
        if (cancelled) return;
        setName(r.name || '');
        setCurrency(r.currency || 'USD');
        setTimezone(r.timezone || 'America/Guayaquil');
        const m = r.settings?.targetMargin;
        setMarginPct(typeof m === 'number' ? String(Math.round(m * 100)) : '60');
        setPricePerLocale(Boolean(r.settings?.pricePerLocaleEnabled));
        const payroll = r.settings?.monthlyPayroll;
        setMonthlyPayroll(typeof payroll === 'number' ? String(payroll) : '');
        const fixed = r.settings?.monthlyFixedExpenses;
        setMonthlyFixedExpenses(typeof fixed === 'number' ? String(fixed) : '');
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
  }, [token]);

  async function handleSave() {
    setError('');
    setSuccess('');
    const marginNum = Number(marginPct);
    if (Number.isNaN(marginNum) || marginNum < 0 || marginNum > 100) {
      setError('El margen debe estar entre 0 y 100.');
      return;
    }
    if (!name.trim()) {
      setError('El nombre del restaurante es obligatorio.');
      return;
    }
    const payrollNum =
      monthlyPayroll === '' ? 0 : Number(monthlyPayroll);
    const fixedNum =
      monthlyFixedExpenses === '' ? 0 : Number(monthlyFixedExpenses);
    if (
      Number.isNaN(payrollNum) ||
      payrollNum < 0 ||
      Number.isNaN(fixedNum) ||
      fixedNum < 0
    ) {
      setError('Los gastos mensuales deben ser números >= 0.');
      return;
    }
    setSaving(true);
    try {
      await updateRestaurant(token, {
        name,
        currency,
        timezone,
        settings: {
          targetMargin: marginNum / 100,
          pricePerLocaleEnabled: pricePerLocale,
          monthlyPayroll: payrollNum,
          monthlyFixedExpenses: fixedNum
        }
      });
      setSuccess('Cambios guardados.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={styles.muted}>Cargando...</p>;

  return (
    <Card padding="lg" className={styles.card}>
      <Input
        label="Nombre del restaurante"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <div className={styles.row}>
        <Select
          label="Moneda"
          options={CURRENCIES}
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        />
        <Select
          label="Zona horaria"
          options={TIMEZONES}
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
      </div>

      <Input
        label="Margen objetivo (%)"
        type="number"
        min="0"
        max="100"
        value={marginPct}
        onChange={(event) => setMarginPct(event.target.value)}
      />

      <Toggle
        checked={pricePerLocale}
        onChange={setPricePerLocale}
        label="Permitir precios distintos por local"
      />

      <div className={styles.row}>
        <Input
          label={`Nómina mensual total (${currency})`}
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={monthlyPayroll}
          onChange={(event) => setMonthlyPayroll(event.target.value)}
        />
        <Input
          label={`Servicios fijos mensuales (${currency})`}
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={monthlyFixedExpenses}
          onChange={(event) => setMonthlyFixedExpenses(event.target.value)}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </Card>
  );
}

export default RestaurantTab;
