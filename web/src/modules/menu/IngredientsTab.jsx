import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  createIngredient,
  getIngredients,
  updateIngredient
} from '../../services/menu.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Select from '../../components/Select/Select.jsx';
import Toggle from '../../components/Toggle/Toggle.jsx';
import { formatCurrency } from '../../utils/format.js';
import styles from './IngredientsTab.module.css';

const UNITS = [
  { value: 'kg', label: 'kg (kilogramo)' },
  { value: 'g', label: 'g (gramo)' },
  { value: 'l', label: 'l (litro)' },
  { value: 'ml', label: 'ml (mililitro)' },
  { value: 'unidad', label: 'unidad' }
];

function IngredientEditor({ ingredient, token, currency, onUpdated }) {
  const [name, setName] = useState(ingredient.name);
  const [unit, setUnit] = useState(ingredient.unit);
  const [price, setPrice] = useState(String(ingredient.currentPrice));
  const [supplier, setSupplier] = useState(ingredient.supplier || '');
  const [active, setActive] = useState(ingredient.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave() {
    setError('');
    setSuccess('');
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError('Precio inválido.');
      return;
    }
    if (!name.trim()) {
      setError('Nombre obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateIngredient(token, ingredient.id, {
        name,
        unit,
        currentPrice: priceNum,
        supplier,
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
    <Card padding="md" className={styles.ingredientCard}>
      <div className={styles.row}>
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Unidad"
          options={UNITS}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
      <div className={styles.row}>
        <Input
          label={`Precio actual (${currency})`}
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Input
          label="Proveedor"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
      </div>
      <Toggle checked={active} onChange={setActive} label="Insumo activo" />

      {ingredient.priceHistory && ingredient.priceHistory.length > 1 && (
        <details className={styles.history}>
          <summary>Histórico de precios ({ingredient.priceHistory.length})</summary>
          <ul className={styles.historyList}>
            {[...ingredient.priceHistory].reverse().map((entry, i) => (
              <li key={i}>
                <span className={styles.historyPrice}>
                  {formatCurrency(entry.price, currency)}
                </span>
                <span className={styles.historyDate}>
                  {new Date(entry.date).toLocaleDateString('es-EC')}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

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

function CreateIngredientModal({ isOpen, onClose, token, currency, onCreated }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setUnit('kg');
    setPrice('');
    setSupplier('');
    setError('');
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Nombre obligatorio.');
      return;
    }
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError('Precio inválido.');
      return;
    }
    setSaving(true);
    try {
      const created = await createIngredient(token, {
        name,
        unit,
        currentPrice: priceNum,
        supplier
      });
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
      title="Agregar insumo"
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
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Unidad"
          options={UNITS}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <Input
          label={`Precio actual (${currency})`}
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Input
          label="Proveedor (opcional)"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Modal>
  );
}

function IngredientsTab({ currency }) {
  const { token } = useAuth();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await getIngredients(token);
        if (cancelled) return;
        setIngredients(list);
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
    setIngredients((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
  }

  function handleCreated(created) {
    setIngredients((prev) => [...prev, created]);
  }

  if (loading) return <p className={styles.muted}>Cargando insumos...</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Agregar insumo
        </Button>
      </div>

      {ingredients.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          <p>Aún no hay insumos. Agrega el primero para empezar.</p>
        </Card>
      ) : (
        <div className={styles.list}>
          {ingredients.map((ing) => (
            <IngredientEditor
              key={ing.id}
              ingredient={ing}
              token={token}
              currency={currency}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}

      <CreateIngredientModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        token={token}
        currency={currency}
        onCreated={handleCreated}
      />
    </div>
  );
}

export default IngredientsTab;
