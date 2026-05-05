import { useId } from 'react';
import styles from './Input.module.css';

function Input({ label, error, id, className, ...rest }) {
  const autoId = useId();
  const inputId = id || autoId;
  const inputClassName = [styles.input, error ? styles.inputError : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input id={inputId} className={inputClassName} {...rest} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

export default Input;
