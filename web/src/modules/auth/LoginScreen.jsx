import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import Button from '../../components/Button/Button.jsx';
import styles from './LoginScreen.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'erase'];
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

function LoginScreen() {
  const { signIn } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const isLocked = attempts >= MAX_ATTEMPTS;
  const canSubmit = pin.length === PIN_LENGTH && !loading && !isLocked;

  function handleKey(key) {
    if (loading || isLocked) return;
    if (error) setError('');
    if (key === 'erase') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    setPin((prev) => (prev.length < PIN_LENGTH ? prev + key : prev));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const result = await signIn(pin);
      if (!result.ok) {
        setError('PIN inválido');
        setPin('');
        setAttempts((prev) => prev + 1);
      }
    } catch (err) {
      setError('No se pudo validar. Intenta de nuevo.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>RESTO</h1>
        <p className={styles.subtitle}>Ingresa tu PIN</p>

        <div className={styles.pinDisplay}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => {
            const filled = pin.length > index;
            return (
              <span
                key={index}
                className={[styles.pinDot, filled ? styles.pinDotFilled : '']
                  .filter(Boolean)
                  .join(' ')}
              />
            );
          })}
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {isLocked && (
          <p className={styles.error}>
            Demasiados intentos. Recarga la página para volver a intentar.
          </p>
        )}

        <div className={styles.keypad}>
          {KEYS.map((key, index) => {
            if (key === '') return <div key={index} />;
            const isErase = key === 'erase';
            return (
              <button
                key={index}
                type="button"
                className={styles.key}
                onClick={() => handleKey(key)}
                disabled={loading || isLocked}
                aria-label={isErase ? 'Borrar' : `Dígito ${key}`}
              >
                {isErase ? '←' : key}
              </button>
            );
          })}
        </div>

        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={styles.submit}
        >
          {loading ? 'Validando...' : 'Entrar'}
        </Button>
      </div>
    </main>
  );
}

export default LoginScreen;
