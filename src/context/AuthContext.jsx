import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginRequest, switchRole as switchRoleRequest } from '../services/api';

const AuthContext = createContext(null);

function tokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp < Date.now();
  } catch {
    return true;
  }
}

function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem('session'));
    if (!saved?.token || tokenExpired(saved.token)) return null;
    return saved;
  } catch {
    return null;
  }
}

function persist(session) {
  if (session) {
    localStorage.setItem('token', session.token);
    localStorage.setItem('session', JSON.stringify(session));
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('session');
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  // Estado del modal de ingreso: rol sugerido, ruta a la que se va después y aviso opcional.
  const [loginModal, setLoginModal] = useState(null);

  useEffect(() => {
    if (!session) persist(null);
  }, [session]);

  const logout = useCallback(() => {
    persist(null);
    setSession(null);
  }, []);

  useEffect(() => {
    const expired = () => {
      logout();
      setLoginModal({ role: 'affiliate', notice: 'Tu sesión expiró. Ingresa de nuevo para continuar.' });
    };
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [logout]);

  const login = useCallback(async (document, password, role) => {
    const data = await loginRequest(document, password, role);
    const next = { token: data.token, user: data.user };
    persist(next);
    setSession(next);
    return next;
  }, []);

  const switchRole = useCallback(async role => {
    const data = await switchRoleRequest(role);
    const next = { token: data.token, user: data.user };
    persist(next);
    setSession(next);
    return next;
  }, []);

  const openLogin = useCallback((options = {}) => setLoginModal({ role: 'affiliate', redirect: '/portal', ...options }), []);
  const closeLogin = useCallback(() => setLoginModal(null), []);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    role: session?.user?.role || null,
    roles: session?.user?.roles || [],
    login,
    logout,
    switchRole,
    loginModal,
    openLogin,
    closeLogin,
  }), [session, login, logout, switchRole, loginModal, openLogin, closeLogin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
