import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  getDish,
  getIngredients,
  saveDishRecipe,
  setDishOverride,
  updateDish
} from '../../services/menu.js';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Input from '../../components/Input/Input.jsx';
import Select from '../../components/Select/Select.jsx';
import Toggle from '../../components/Toggle/Toggle.jsx';
import {
  formatCurrency,
  formatPercent,
  formatQuantity
} from '../../utils/format.js';
import styles from './DishEditor.module.css';

const STATIONS = [
  { value: 'hot', label: 'Cocina caliente' },
  { value: 'cold', label: 'Cocina fría' },
  { value: 'bar', label: 'Bar' }
];

function BasicSection({ dish, token, currency, onSaved }) {
  const [name, setName] = useState(dish.name);
  const [basePrice, setBasePrice] = useState(String(dish.basePrice));
  const [category, setCategory] = useState(dish.category || '');
  const [station, setStation] = useState(dish.station || 'hot');
  const [photoUrl, setPhotoUrl] = useState(dish.photoUrl || '');
  const [active, setActive] = useState(dish.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave() {
    setError('');
    setSuccess('');
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
      const updated = await updateDish(token, dish.id, {
        name,
        basePrice: priceNum,
        category,
        station,
        photoUrl,
        active
      });
      setSuccess('Guardado.');
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg" className={styles.section}>
      <h2>Datos básicos</h2>

      <div className={styles.row}>
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
      </div>

      <div className={styles.row}>
        <Input
          label="Categoría"
          placeholder="Entradas, Platos fuertes..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <Select
          label="Estación de cocina"
          options={STATIONS}
          value={station}
          onChange={(e) => setStation(e.target.value)}
        />
      </div>

      <Input
        label="URL de la foto (opcional)"
        placeholder="https://..."
        value={photoUrl}
        onChange={(e) => setPhotoUrl(e.target.value)}
      />

      {photoUrl && (
        <div className={styles.preview}>
          <img src={photoUrl} alt="" className={styles.previewImg} />
        </div>
      )}

      <Toggle checked={active} onChange={setActive} label="Plato activo" />

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar datos'}
        </Button>
      </div>
    </Card>
  );
}

function VariantsSection({ dish, token, currency, onSaved }) {
  const [variants, setVariants] = useState(
    Array.isArray(dish.variants) ? dish.variants.map((v) => ({ ...v })) : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function addVariant() {
    setVariants((prev) => [...prev, { name: '', basePrice: 0 }]);
  }

  function removeVariant(idx) {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateVariant(idx, field, value) {
    setVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v))
    );
  }

  async function handleSave() {
    setError('');
    setSuccess('');
    for (const v of variants) {
      if (!v.name || !v.name.trim()) {
        setError('Cada variante necesita un nombre.');
        return;
      }
      if (typeof v.basePrice !== 'number' || v.basePrice < 0) {
        setError('Precio de variante inválido.');
        return;
      }
    }
    setSaving(true);
    try {
      const cleaned = variants.map((v) => ({
        name: v.name.trim(),
        basePrice: Number(v.basePrice)
      }));
      const updated = await updateDish(token, dish.id, { variants: cleaned });
      setSuccess('Variantes guardadas.');
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg" className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2>Variantes de precio</h2>
        <Button variant="secondary" onClick={addVariant}>
          Agregar variante
        </Button>
      </header>

      <p className={styles.muted}>
        Si el plato tiene tamaños o presentaciones distintas (media/entera,
        individual/familiar), agrégalas aquí. Si está vacío, se usa el precio
        base del plato.
      </p>

      {variants.length > 0 && (
        <div className={styles.variantList}>
          {variants.map((v, idx) => (
            <div key={idx} className={styles.variantRow}>
              <Input
                label={idx === 0 ? 'Nombre' : undefined}
                placeholder="Media, entera..."
                value={v.name}
                onChange={(e) => updateVariant(idx, 'name', e.target.value)}
              />
              <Input
                label={idx === 0 ? `Precio (${currency})` : undefined}
                type="number"
                min="0"
                step="0.01"
                value={v.basePrice}
                onChange={(e) =>
                  updateVariant(idx, 'basePrice', Number(e.target.value))
                }
              />
              <Button variant="ghost" onClick={() => removeVariant(idx)}>
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar variantes'}
        </Button>
      </div>
    </Card>
  );
}

function RecipeSection({ dish, ingredients, token, currency, targetMargin, onSaved }) {
  const initial = dish.recipe?.items
    ? dish.recipe.items.map((i) => ({
        ingredientId: i.ingredientId,
        quantity: i.quantity
      }))
    : [];
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const ingredientsMap = new Map(ingredients.map((i) => [i.id, i]));

  function addItem() {
    const firstActive = ingredients.find((i) => i.active);
    if (!firstActive) {
      setError('Crea al menos un insumo primero.');
      return;
    }
    setItems((prev) => [
      ...prev,
      { ingredientId: firstActive.id, quantity: 0 }
    ]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx, field, value) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );
  }

  let totalCost = 0;
  for (const item of items) {
    const ing = ingredientsMap.get(item.ingredientId);
    if (!ing) continue;
    totalCost += (ing.currentPrice || 0) * (Number(item.quantity) || 0);
  }
  const margin =
    dish.basePrice > 0 ? (dish.basePrice - totalCost) / dish.basePrice : null;
  const marginBelow = typeof margin === 'number' && margin < targetMargin;

  async function handleSave() {
    setError('');
    setSuccess('');
    for (const it of items) {
      if (!it.ingredientId) {
        setError('Selecciona un insumo en cada línea.');
        return;
      }
      const q = Number(it.quantity);
      if (Number.isNaN(q) || q <= 0) {
        setError('La cantidad debe ser mayor a 0.');
        return;
      }
    }
    setSaving(true);
    try {
      const cleaned = items.map((it) => ({
        ingredientId: it.ingredientId,
        quantity: Number(it.quantity)
      }));
      await saveDishRecipe(token, dish.id, cleaned);
      setSuccess('Receta guardada.');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const ingredientOptions = ingredients
    .filter((i) => i.active)
    .map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));

  return (
    <Card padding="lg" className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2>Receta</h2>
        <Button variant="secondary" onClick={addItem}>
          Agregar insumo
        </Button>
      </header>

      <p className={styles.muted}>
        Insumos que se consumen para preparar este plato, con sus cantidades.
        Si la receta está vacía, no se calcula costo ni margen.
      </p>

      {items.length > 0 ? (
        <div className={styles.recipeList}>
          {items.map((it, idx) => {
            const ing = ingredientsMap.get(it.ingredientId);
            const lineCost = ing
              ? (ing.currentPrice || 0) * (Number(it.quantity) || 0)
              : 0;
            return (
              <div key={idx} className={styles.recipeRow}>
                <Select
                  options={ingredientOptions}
                  value={it.ingredientId}
                  onChange={(e) =>
                    updateItem(idx, 'ingredientId', e.target.value)
                  }
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.quantity}
                  onChange={(e) =>
                    updateItem(idx, 'quantity', Number(e.target.value))
                  }
                />
                <span className={styles.recipeUnit}>{ing?.unit || ''}</span>
                <span className={styles.recipeCost}>
                  {formatCurrency(lineCost, currency)}
                </span>
                <Button variant="ghost" onClick={() => removeItem(idx)}>
                  Quitar
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.empty}>Aún no hay insumos en la receta.</p>
      )}

      <div className={styles.recipeTotals}>
        <div className={styles.totalLine}>
          <span>Costo total</span>
          <span className={styles.totalValue}>
            {formatCurrency(totalCost, currency)}
          </span>
        </div>
        <div className={styles.totalLine}>
          <span>Margen</span>
          <span
            className={[styles.totalValue, marginBelow ? styles.danger : '']
              .filter(Boolean)
              .join(' ')}
          >
            {margin === null ? '—' : formatPercent(margin)}
            {marginBelow && (
              <span className={styles.muted}>
                {' '}bajo objetivo ({formatPercent(targetMargin)})
              </span>
            )}
          </span>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar receta'}
        </Button>
      </div>
    </Card>
  );
}

function OverridesSection({ dish, locales, token, currency, onSaved }) {
  const initial = {};
  for (const o of dish.localOverrides || []) initial[o.localeId] = o.price;
  const [overrides, setOverrides] = useState(initial);
  const [saving, setSaving] = useState({});
  const [errors, setErrors] = useState({});

  async function handleSave(localeId) {
    setErrors((prev) => ({ ...prev, [localeId]: '' }));
    const raw = overrides[localeId];
    const isEmpty = raw === '' || raw === undefined || raw === null;
    const value = isEmpty ? null : Number(raw);
    if (!isEmpty && (Number.isNaN(value) || value < 0)) {
      setErrors((prev) => ({ ...prev, [localeId]: 'Precio inválido.' }));
      return;
    }

    setSaving((prev) => ({ ...prev, [localeId]: true }));
    try {
      await setDishOverride(token, dish.id, localeId, value);
      onSaved();
    } catch (err) {
      setErrors((prev) => ({ ...prev, [localeId]: err.message }));
    } finally {
      setSaving((prev) => ({ ...prev, [localeId]: false }));
    }
  }

  return (
    <Card padding="lg" className={styles.section}>
      <h2>Precio por local</h2>
      <p className={styles.muted}>
        Si dejas vacío, se cobra el precio base ({formatCurrency(dish.basePrice, currency)}).
        Para cobrar un precio distinto en un local, escríbelo y guarda.
      </p>

      <div className={styles.overrideList}>
        {locales.map((locale) => (
          <div key={locale.id} className={styles.overrideRow}>
            <span className={styles.localeName}>{locale.name}</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Sin override"
              value={overrides[locale.id] ?? ''}
              onChange={(e) =>
                setOverrides((prev) => ({
                  ...prev,
                  [locale.id]: e.target.value
                }))
              }
            />
            <Button
              variant="secondary"
              onClick={() => handleSave(locale.id)}
              disabled={saving[locale.id]}
            >
              {saving[locale.id] ? 'Guardando...' : 'Guardar'}
            </Button>
            {errors[locale.id] && (
              <span className={styles.error}>{errors[locale.id]}</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function DishEditor({
  dishId,
  currency,
  targetMargin,
  pricePerLocaleEnabled,
  locales,
  onClose
}) {
  const { token } = useAuth();
  const [dish, setDish] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    try {
      const [d, i] = await Promise.all([
        getDish(token, dishId),
        getIngredients(token)
      ]);
      setDish(d);
      setIngredients(i);
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
      await reload();
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishId, token]);

  if (loading) return <p className={styles.muted}>Cargando plato...</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!dish) return null;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1>{dish.name}</h1>
          <p className={styles.subtitle}>Editar plato y receta</p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Volver a la carta
        </Button>
      </header>

      <div className={styles.sections}>
        <BasicSection
          dish={dish}
          token={token}
          currency={currency}
          onSaved={(updated) => setDish((prev) => ({ ...prev, ...updated }))}
        />

        <VariantsSection
          dish={dish}
          token={token}
          currency={currency}
          onSaved={(updated) => setDish((prev) => ({ ...prev, ...updated }))}
        />

        <RecipeSection
          dish={dish}
          ingredients={ingredients}
          token={token}
          currency={currency}
          targetMargin={targetMargin}
          onSaved={reload}
        />

        {pricePerLocaleEnabled && (
          <OverridesSection
            dish={dish}
            locales={locales}
            token={token}
            currency={currency}
            onSaved={reload}
          />
        )}
      </div>
    </main>
  );
}

export default DishEditor;
