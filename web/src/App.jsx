import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import LoginScreen from './modules/auth/LoginScreen.jsx';
import LocaleSelector from './modules/auth/LocaleSelector.jsx';
import HomePlaceholder from './modules/home/HomePlaceholder.jsx';
import ConfigScreen from './modules/config/ConfigScreen.jsx';
import MenuScreen from './modules/menu/MenuScreen.jsx';
import FloorScreen from './modules/floor/FloorScreen.jsx';
import PlanEditor from './modules/floor/PlanEditor.jsx';
import KitchenScreen from './modules/kitchen/KitchenScreen.jsx';
import CashierScreen from './modules/cashier/CashierScreen.jsx';
import PanelScreen from './modules/panel/PanelScreen.jsx';

function AppContent() {
  const { user, activeLocaleId } = useAuth();
  const [screen, setScreen] = useState('home');

  if (!user) return <LoginScreen />;
  if (!activeLocaleId) return <LocaleSelector />;

  if (screen === 'config') {
    return <ConfigScreen onClose={() => setScreen('home')} />;
  }
  if (screen === 'menu') {
    return <MenuScreen onClose={() => setScreen('home')} />;
  }
  if (screen === 'floor') {
    return <FloorScreen onClose={() => setScreen('home')} />;
  }
  if (screen === 'plan-editor') {
    return <PlanEditor onClose={() => setScreen('home')} />;
  }
  if (screen === 'kitchen') {
    return <KitchenScreen onClose={() => setScreen('home')} />;
  }
  if (screen === 'cashier') {
    return <CashierScreen onClose={() => setScreen('home')} />;
  }
  if (screen === 'panel') {
    return <PanelScreen onClose={() => setScreen('home')} />;
  }

  return (
    <HomePlaceholder
      onOpenConfig={() => setScreen('config')}
      onOpenMenu={() => setScreen('menu')}
      onOpenFloor={() => setScreen('floor')}
      onOpenPlanEditor={() => setScreen('plan-editor')}
      onOpenKitchen={() => setScreen('kitchen')}
      onOpenCashier={() => setScreen('cashier')}
      onOpenPanel={() => setScreen('panel')}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
