import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { createDish, getDishes, updateDish } from '../../services/menu.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Select from '../../components/Select/Select.jsx';
import { formatCurrency, formatPercent } from '../../utils/format.js';
import styles from './DishesTab.module.css';

const STATIONS = [
  { value: 'hot', label: 'Cocina caliente' },
  { value: 'cold', label: 'Cocina fría' },
  { value: 'bar', label: 'Bar' }
];

const STATION_LABEL = {
  hot: 'Caliente',
  cold: 'Fría',
  bar: 'Bar'
};

function CreateDishModal({ isOpen, onClose, token, currency, onCreated }) {
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [category, setCategory] = useState('');
  const [station, setStation] = useState('hot');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setBasePrice('');
    setCategory('');
    setStation('hot');
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
    const priceNum = Number(basePrice);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError('Precio inválido.');
      return;
    }
    setSaving(true);
    try {
      const created = await createDish(token, {
        name,
        basePrice: priceNum,
        category,
        station
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
      title="Agregar plato"
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
        <Input
          label={`Precio base (${currency})`}
          type="number"
          min="0"
          step="0.01"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
        />
        <Input
          label="Categoría"
          placeholder="Entradas, Platos fuertes, Postres, Bebidas..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <Select
          label="Estación de cocina"
          options={STATIONS}
          value={station}
          onChange={(e) => setStation(e.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Modal>
  );
}

function DishCard({ dish, currency, targetMargin, token, onEdit, onUpdated }) {
  const [toggling, setToggling] = useState(false);

  async function toggleActive() {
    setToggling(true);
    try {
      const updated = await updateDish(token, dish.id, { active: !dish.active });
      onUpdated({ ...dish, active: updated.active });
    } catch {
      // silencioso por ahora
    } finally {
      setToggling(false);
    }
  }

  const marginBelow =
    dish.hasRecipe &&
    typeof dish.margin === 'number' &&
    dish.margin < targetMargin;

  return (
    <Card padding="md" className={styles.dishCard}>
      <div className={styles.dishHeader}>
        <div>
          <h3 className={styles.dishName}>
            {dish.name}
            {!dish.active && <span className={styles.inactiveTag}>inactivo</span>}
          </h3>
          <div className={styles.dishMeta}>
            {dish.category && <span className={styles.metaChip}>{dish.category}</span>}
            <span className={styles.metaChip}>{STATION_LABEL[dish.station]}</span>
          </div>
        </div>
        <div className={styles.priceBlock}>
          <span className={styles.price}>
            {formatCurrency(dish.basePrice, currency)}
          </span>
        </div>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Costo</span>
          <span className={styles.metricValue}>
            {dish.hasRecipe ? formatCurrency(dish.cost, currency) : 'Sin receta'}
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Margen</span>
          <span
            className={[
              styles.metricValue,
              marginBelow ? styles.metricDanger : ''
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {dish.hasRecipe ? formatPercent(dish.margin) : '—'}
            {marginBelow && (
              <span className={styles.marginAlert}>
                {' '}bajo objetivo ({formatPercent(targetMargin)})
              </span>
            )}
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={toggleActive} disabled={toggling}>
          {dish.active ? 'Desactivar' : 'Activar'}
        </Button>
        <Button variant="primary" onClick={() => onEdit(dish.id)}>
          Editar
        </Button>
      </div>
    </Card>
  );
}

function DishesTab({ currency, targetMargin, onEditDish }) {
  const { token } = useAuth();
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    try {
      const list = await getDishes(token);
      setDishes(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (cancelled) return;
      await load();
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleUpdated(updated) {
    setDishes((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
  }

  function handleCreated(created) {
    setDishes((prev) => [...prev, created]);
  }

  if (loading) return <p className={styles.muted}>Cargando platos...</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Agregar plato
        </Button>
      </div>

      {dishes.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          <p>
            Aún no hay platos en la carta. Agrega el primero. Después podrás
            asignarle insumos y receta.
          </p>
        </Card>
      ) : (
        <div className={styles.list}>
          {dishes.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              currency={currency}
              targetMargin={targetMargin}
              token={token}
              onEdit={onEditDish}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}

      <CreateDishModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        token={token}
        currency={currency}
        onCreated={handleCreated}
      />
    </div>
  );
}

export default DishesTab;
