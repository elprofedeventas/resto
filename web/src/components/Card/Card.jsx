import styles from './Card.module.css';

const PADDING_CLASS = {
  sm: styles.paddingSm,
  md: styles.paddingMd,
  lg: styles.paddingLg
};

function Card({ padding = 'md', children, className, ...rest }) {
  const paddingClass = PADDING_CLASS[padding] || PADDING_CLASS.md;
  const finalClassName = [styles.card, paddingClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={finalClassName} {...rest}>
      {children}
    </div>
  );
}

export default Card;
