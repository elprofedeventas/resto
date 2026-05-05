import { useId } from 'react';
import styles from './Select.module.css';

function Select({ label, options = [], error, id, className, ...rest }) {
  const autoId = useId();
  const selectId = id || autoId;
  const selectClassName = [styles.select, error ? styles.selectError : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
        </label>
      )}
      <select id={selectId} className={selectClassName} {...rest}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

export default Select;
