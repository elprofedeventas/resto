import { useAuth } from '../../hooks/useAuth.jsx';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import styles from './LocaleSelector.module.css';

function LocaleSelector() {
  const { user, locales, selectLocale, signOut } = useAuth();

  return (
    <main className={styles.screen}>
      <Card padding="lg" className={styles.card}>
        <h1 className={styles.title}>Hola, {user.name}</h1>
        <p className={styles.subtitle}>
          Selecciona el local en el que vas a trabajar
        </p>

        <div className={styles.list}>
          {locales.map((locale) => (
            <Button
              key={locale.id}
              variant="secondary"
              onClick={() => selectLocale(locale.id)}
            >
              {locale.name}
            </Button>
          ))}
        </div>

        <Button variant="ghost" onClick={signOut} className={styles.exit}>
          Salir
        </Button>
      </Card>
    </main>
  );
}

export default LocaleSelector;
