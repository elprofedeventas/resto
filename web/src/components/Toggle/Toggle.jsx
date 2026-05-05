import styles from './Toggle.module.css';

function Toggle({ checked, onChange, label, disabled = false }) {
  const wrapperClass = [styles.wrapper, disabled ? styles.disabled : '']
    .filter(Boolean)
    .join(' ');

  return (
    <label className={wrapperClass}>
      <input
        type="checkbox"
        className={styles.input}
        checked={Boolean(checked)}
        onChange={(event) => onChange?.(event.target.checked)}
        disabled={disabled}
      />
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}

export default Toggle;
