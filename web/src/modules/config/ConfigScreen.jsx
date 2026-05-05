import { useState } from 'react';
import Button from '../../components/Button/Button.jsx';
import RestaurantTab from './RestaurantTab.jsx';
import LocalesTab from './LocalesTab.jsx';
import UsersTab from './UsersTab.jsx';
import styles from './ConfigScreen.module.css';

const TABS = [
  { id: 'restaurant', label: 'Restaurante' },
  { id: 'locales', label: 'Locales' },
  { id: 'users', label: 'Usuarios' }
];

function ConfigScreen({ onClose }) {
  const [tab, setTab] = useState('restaurant');

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1>Configuración</h1>
          <p className={styles.subtitle}>Ajustes generales del restaurante</p>
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
        {tab === 'restaurant' && <RestaurantTab />}
        {tab === 'locales' && <LocalesTab />}
        {tab === 'users' && <UsersTab />}
      </section>
    </main>
  );
}

export default ConfigScreen;
