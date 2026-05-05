import styles from './Button.module.css';

const VARIANT_CLASS = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger
};

function Button({
  variant = 'primary',
  type = 'button',
  disabled = false,
  onClick,
  children,
  className,
  ...rest
}) {
  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;
  const finalClassName = [styles.button, variantClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={finalClassName}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
