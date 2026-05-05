import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getLocales, updateLocale } from '../../services/config.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Toggle from '../../components/Toggle/Toggle.jsx';
import styles from './LocalesTab.module.css';

function LocaleEditor({ locale, token, onUpdated }) {
  const [name, setName] = useState(locale.name || '');
  const [address, setAddress] = useState(locale.address || '');
  const [phone, setPhone] = useState(locale.phone || '');
  const [active, setActive] = useState(locale.active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave() {
    setError('');
    setSuccess('');
    if (!name.trim()) {
      setError('El nombre del local es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateLocale(token, locale.id, {
        name,
        address,
        phone,
        active
      });
      setSuccess('Guardado.');
      onUpdated(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="md" className={styles.localeCard}>
      <header className={styles.localeHeader}>
        <span className={styles.localeId}>{locale.id}</span>
      </header>

      <div className={styles.row}>
        <Input
          label="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <Input
        label="Dirección"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />
      <Toggle checked={active} onChange={setActive} label="Local activo" />

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </Card>
  );
}

function LocalesTab() {
  const { token } = useAuth();
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await getLocales(token);
        if (cancelled) return;
        setLocales(list);
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

  function handleUpdated(updated) {
    setLocales((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  if (loading) return <p className={styles.muted}>Cargando locales...</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.list}>
      {locales.map((locale) => (
        <LocaleEditor
          key={locale.id}
          locale={locale}
          token={token}
          onUpdated={handleUpdated}
        />
      ))}
    </div>
  );
}

export default LocalesTab;
