import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { getRestaurant, getLocales } from '../../services/config.js';
import Button from '../../components/Button/Button.jsx';
import DishesTab from './DishesTab.jsx';
import IngredientsTab from './IngredientsTab.jsx';
import DishEditor from './DishEditor.jsx';
import styles from './MenuScreen.module.css';

const TABS = [
  { id: 'dishes', label: 'Platos' },
  { id: 'ingredients', label: 'Insumos' }
];

function MenuScreen({ onClose }) {
  const { token } = useAuth();
  const [tab, setTab] = useState('dishes');
  const [editingDishId, setEditingDishId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [locales, setLocales] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [r, l] = await Promise.all([
          getRestaurant(token),
          getLocales(token)
        ]);
        if (cancelled) return;
        setRestaurant(r);
        setLocales(l);
      } catch {
        // los hijos manejan errores propios
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const currency = restaurant?.currency || 'USD';
  const targetMargin =
    typeof restaurant?.settings?.targetMargin === 'number'
      ? restaurant.settings.targetMargin
      : 0.6;
  const pricePerLocaleEnabled = Boolean(
    restaurant?.settings?.pricePerLocaleEnabled
  );

  if (editingDishId) {
    return (
      <DishEditor
        dishId={editingDishId}
        currency={currency}
        targetMargin={targetMargin}
        pricePerLocaleEnabled={pricePerLocaleEnabled}
        locales={locales}
        onClose={() => setEditingDishId(null)}
      />
    );
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1>Carta</h1>
          <p className={styles.subtitle}>
            Platos, insumos, recetas y márgenes
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Volver
        </Button>
      </header>

      <nav className={styles.tabs} role="tablist">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={[styles.tab, isActive ? styles.tabActive : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <section className={styles.content}>
        {tab === 'dishes' && (
          <DishesTab
            currency={currency}
            targetMargin={targetMargin}
            onEditDish={setEditingDishId}
          />
        )}
        {tab === 'ingredients' && <IngredientsTab currency={currency} />}
      </section>
    </main>
  );
}

export default MenuScreen;
