/* RESTO — hook y provider de autenticación.

   Sesión en memoria pura: al refrescar la página, el usuario debe volver a
   ingresar su PIN. Decisión deliberada de V1. */

import { createContext, useCallback, useContext, useState } from 'react';
import { login as loginService, logout as logoutService } from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [locales, setLocales] = useState([]);
  const [activeLocaleId, setActiveLocaleId] = useState(null);

  const signIn = useCallback(async (pin) => {
    const result = await loginService(pin);
    if (!result.ok) {
      return { ok: false };
    }
    setUser(result.user);
    setToken(result.token);
    setLocales(result.locales || []);
    if (result.user.localeIds.length === 1) {
      setActiveLocaleId(result.user.localeIds[0]);
    }
    return { ok: true, needsLocaleSelection: result.user.localeIds.length > 1 };
  }, []);

  const selectLocale = useCallback((localeId) => {
    setActiveLocaleId(localeId);
  }, []);

  const signOut = useCallback(async () => {
    if (token) {
      await logoutService(token);
    }
    setUser(null);
    setToken(null);
    setLocales([]);
    setActiveLocaleId(null);
  }, [token]);

  const value = {
    user,
    token,
    locales,
    activeLocaleId,
    isAuthenticated: Boolean(user) && Boolean(activeLocaleId),
    signIn,
    selectLocale,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
