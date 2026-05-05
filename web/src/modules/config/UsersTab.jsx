import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  createUser,
  getLocales,
  getUsers,
  updateUser
} from '../../services/config.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Select from '../../components/Select/Select.jsx';
import Toggle from '../../components/Toggle/Toggle.jsx';
import styles from './UsersTab.module.css';

const ROLES = [
  { value: 'owner', label: 'Propietario' },
  { value: 'manager', label: 'Encargado' },
  { value: 'cashier', label: 'Cajero' },
  { value: 'waiter', label: 'Mesero' },
  { value: 'cook', label: 'Cocina' },
  { value: 'bar', label: 'Bar' }
];

function LocalesPicker({ allLocales, value, onChange }) {
  function toggle(id) {
    const set = new Set(value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  }

  return (
    <div className={styles.localesGroup}>
      <span className={styles.localesLabel}>Locales asignados</span>
      <div className={styles.localesList}>
        {allLocales.map((l) => (
          <label key={l.id} className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={value.includes(l.id)}
              onChange={() => toggle(l.id)}
            />
            <span>{l.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ChangePinModal({ isOpen, onClose, userId, userName, isSelf, token }) {
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setPin('');
    setError('');
    onClose();
  }

  async function handleSave() {
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe ser de 4 dígitos.');
      return;
    }
    setSaving(true);
    try {
      await updateUser(token, userId, { pin });
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
      title={`Cambiar PIN — ${userName}`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Cambiar PIN'}
          </Button>
        </>
      }
    >
      {isSelf && (
        <p className={styles.warning}>
          Vas a cambiar tu propio PIN. Anótalo antes de guardar.
        </p>
      )}
      <Input
        label="PIN nuevo (4 dígitos)"
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
        error={error}
      />
    </Modal>
  );
}

function UserEditor({ user, locales, isSelf, token, onUpdated }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [localeIds, setLocaleIds] = useState(user.localeIds);
  const [active, setActive] = useState(user.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);

  async function handleSave() {
    setError('');
    setSuccess('');
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (localeIds.length === 0) {
      setError('Asigna al menos un local.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateUser(token, user.id, {
        name,
        role,
        localeIds,
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
    <Card padding="md" className={styles.userCard}>
      <header className={styles.userHeader}>
        <h3 className={styles.userName}>
          {user.name}
          {isSelf && <span className={styles.selfTag}>tú</span>}
        </h3>
        <span className={styles.userId}>{user.id}</span>
      </header>

      <div className={styles.row}>
        <Input
          label="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label="Rol"
          options={ROLES}
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={isSelf}
        />
      </div>

      <LocalesPicker
        allLocales={locales}
        value={localeIds}
        onChange={setLocaleIds}
      />

      <Toggle
        checked={active}
        onChange={setActive}
        label="Usuario activo"
        disabled={isSelf}
      />

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setPinModalOpen(true)}>
          Cambiar PIN
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      <ChangePinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        userId={user.id}
        userName={user.name}
        isSelf={isSelf}
        token={token}
      />
    </Card>
  );
}

function CreateUserModal({ isOpen, onClose, locales, token, onCreated }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('waiter');
  const [pin, setPin] = useState('');
  const [localeIds, setLocaleIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setRole('waiter');
    setPin('');
    setLocaleIds([]);
    setError('');
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe ser de 4 dígitos.');
      return;
    }
    if (localeIds.length === 0) {
      setError('Asigna al menos un local.');
      return;
    }
    setSaving(true);
    try {
      const created = await createUser(token, { name, role, pin, localeIds });
      onCreated(created);
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
      title="Agregar usuario"
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
      <div className={styles.modalForm}>
        <Input
          label="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label="Rol"
          options={ROLES}
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
        <Input
          label="PIN (4 dígitos)"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
        />
        <LocalesPicker
          allLocales={locales}
          value={localeIds}
          onChange={setLocaleIds}
        />
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Modal>
  );
}

function UsersTab() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [u, l] = await Promise.all([getUsers(token), getLocales(token)]);
        if (cancelled) return;
        setUsers(u);
        setLocales(l);
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
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  function handleCreated(created) {
    setUsers((prev) => [...prev, created]);
  }

  if (loading) return <p className={styles.muted}>Cargando usuarios...</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Agregar usuario
        </Button>
      </div>

      <div className={styles.list}>
        {users.map((u) => (
          <UserEditor
            key={u.id}
            user={u}
            locales={locales}
            isSelf={u.id === currentUser.id}
            token={token}
            onUpdated={handleUpdated}
          />
        ))}
      </div>

      <CreateUserModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        locales={locales}
        token={token}
        onCreated={handleCreated}
      />
    </div>
  );
}

export default UsersTab;
