import { useAuth } from '../../hooks/useAuth.jsx';
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import styles from './HomePlaceholder.module.css';

const ROLE_LABEL = {
  owner: 'Propietario',
  manager: 'Encargado',
  cashier: 'Cajero',
  waiter: 'Mesero',
  cook: 'Cocina',
  bar: 'Bar'
};

const ROLES_THAT_TAKE_ORDERS = ['owner', 'manager', 'waiter'];
const ROLES_THAT_SEE_KITCHEN = ['owner', 'manager', 'cook', 'bar'];
const ROLES_THAT_SEE_CASHIER = ['owner', 'manager', 'cashier'];
const ROLES_THAT_SEE_PANEL = ['owner', 'manager'];

function HomePlaceholder({
  onOpenConfig,
  onOpenMenu,
  onOpenFloor,
  onOpenPlanEditor,
  onOpenKitchen,
  onOpenCashier,
  onOpenPanel
}) {
  const { user, activeLocaleId, signOut } = useAuth();
  const isOwner = user.role === 'owner';
  const canSeeFloor = ROLES_THAT_TAKE_ORDERS.includes(user.role);
  const canSeeKitchen = ROLES_THAT_SEE_KITCHEN.includes(user.role);
  const canSeeCashier = ROLES_THAT_SEE_CASHIER.includes(user.role);
  const canSeePanel = ROLES_THAT_SEE_PANEL.includes(user.role);

  return (
    <main className={styles.screen}>
      <Card padding="lg">
        <h1>Hola, {user.name}</h1>
        <p className={styles.muted}>
          Rol: <strong>{ROLE_LABEL[user.role] || user.role}</strong> &middot;{' '}
          Local activo: <strong>{activeLocaleId}</strong>
        </p>
        <p className={styles.muted}>Sesión iniciada.</p>

        <div className={styles.actions}>
          {canSeeFloor && onOpenFloor && (
            <Button variant="primary" onClick={onOpenFloor}>
              Salón
            </Button>
          )}
          {canSeeKitchen && onOpenKitchen && (
            <Button variant="primary" onClick={onOpenKitchen}>
              Cocina
            </Button>
          )}
          {canSeeCashier && onOpenCashier && (
            <Button variant="primary" onClick={onOpenCashier}>
              Caja
            </Button>
          )}
          {canSeePanel && onOpenPanel && (
            <Button variant="primary" onClick={onOpenPanel}>
              Panel
            </Button>
          )}
          {isOwner && onOpenMenu && (
            <Button variant="secondary" onClick={onOpenMenu}>
              Carta
            </Button>
          )}
          {isOwner && onOpenPlanEditor && (
            <Button variant="secondary" onClick={onOpenPlanEditor}>
              Editor de plano
            </Button>
          )}
          {isOwner && onOpenConfig && (
            <Button variant="secondary" onClick={onOpenConfig}>
              Configuración
            </Button>
          )}
          <Button variant="ghost" onClick={signOut}>
            Cerrar sesión
          </Button>
        </div>
      </Card>
    </main>
  );
}

export default HomePlaceholder;
