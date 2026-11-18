import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  login as loginRequest, logoutRequest, refreshSession, setAccessToken, switchRole as switchRoleRequest, verifyMfa as verifyMfaRequest,
} from '../services/api';

/**
 * Sesión segura:
 *  - El token de acceso (JWT de 15 min) vive solo en memoria (services/api.js), nunca en localStorage.
 *  - Al abrir o recargar la página se recupera la sesión con la cookie HttpOnly (/auth/refresh).
 *  - Médico y administrador con verificación en dos pasos reciben `mfaRequired` y luego envían el código.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  // Estado del modal de ingreso: rol sugerido, ruta a la que se va después y aviso opcional.
  const [loginModal, setLoginModal] = useState(null);

  const applySession = useCallback(data => {
    if (data?.token) {
      setAccessToken(data.token);
      const next = { user: data.user };
      setSession(next);
      return next;
    }
    setAccessToken(null);
    setSession(null);
    return null;
  }, []);

  // Recupera la sesión al cargar la aplicación (la cookie la envía el navegador).
  useEffect(() => {
    let active = true;
    // Versiones anteriores guardaban el token en localStorage: se borra para no dejarlo expuesto.
    try { localStorage.removeItem('token'); localStorage.removeItem('session'); } catch { /* navegador sin storage */ }
    refreshSession().then(data => {
      if (!active) return;
      if (data) applySession(data);
      setReady(true);
    });
    return () => { active = false; };
  }, [applySession]);

  const logout = useCallback(async () => {
    try { await logoutRequest(); } catch { /* aunque falle la red, se cierra localmente */ }
    applySession(null);
  }, [applySession]);

  useEffect(() => {
    const expired = () => {
      applySession(null);
      setLoginModal({ role: 'affiliate', notice: 'Tu sesión expiró. Ingresa de nuevo para continuar.' });
    };
    const refreshed = event => { if (event.detail?.user) setSession({ user: event.detail.user }); };
    window.addEventListener('auth:expired', expired);
    window.addEventListener('auth:refreshed', refreshed);
    return () => {
      window.removeEventListener('auth:expired', expired);
      window.removeEventListener('auth:refreshed', refreshed);
    };
  }, [applySession]);

  /** Devuelve la sesión, o { mfaRequired, mfaToken } si falta el código de 2 pasos. */
  const login = useCallback(async (document, password, role) => {
    const data = await loginRequest(document, password, role);
    if (data.mfaRequired) return { mfaRequired: true, mfaToken: data.mfaToken };
    return applySession(data);
  }, [applySession]);

  const verifyMfa = useCallback(async (mfaToken, code) => applySession(await verifyMfaRequest(mfaToken, code)), [applySession]);

  /** Aplica una respuesta de sesión (p. ej. al activar 2 pasos el backend entrega una sesión nueva). */
  const updateSession = useCallback(data => applySession(data), [applySession]);

  const switchRole = useCallback(async role => {
    const data = await switchRoleRequest(role);
    if (data.mfaRequired) {
      setLoginModal({ role, mfaToken: data.mfaToken, notice: 'Escribe el código de tu app autenticadora para usar este perfil.' });
      return { mfaRequired: true };
    }
    return applySession(data);
  }, [applySession]);

  const openLogin = useCallback((options = {}) => setLoginModal({ role: 'affiliate', redirect: '/portal', ...options }), []);
  const closeLogin = useCallback(() => setLoginModal(null), []);

  const value = useMemo(() => ({
    session,
    ready,
    user: session?.user || null,
    role: session?.user?.role || null,
    roles: session?.user?.roles || [],
    login,
    verifyMfa,
    updateSession,
    logout,
    switchRole,
    loginModal,
    openLogin,
    closeLogin,
  }), [session, ready, login, verifyMfa, updateSession, logout, switchRole, loginModal, openLogin, closeLogin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
