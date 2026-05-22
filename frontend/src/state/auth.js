import { apiRequest } from '../services/apiClient.js';
import { getState, setState } from './store.js';

export async function fetchCurrentUser() {
  try {
    const data = await apiRequest('/api/auth/me');
    const user = data?.usuario || null;
    const rawRole = (user && (user.Tipo || user.tipo)) || null;
    const role = rawRole ? String(rawRole).toLowerCase() : 'public';
    setState({ user, role });
    return user;
  } catch (error) {
    setState({ user: null, role: 'public' });
    return null;
  }
}

export async function registerUser(payload) {
  // Some environments expose different auth endpoints and field names.
  // We attempt a small compatibility matrix with timeouts and graceful fallbacks.
  const endpoints = ['/api/auth/registro', '/api/auth/register', '/auth/registro', '/auth/register'];
  const variants = (
    () => {
      try {
        const nombre = payload?.nombre || payload?.Nombre || '';
        const email = payload?.email || payload?.Email || '';
        const contrasena = payload?.contrasena || payload?.Contrasena || payload?.password || '';
        const rol = (payload?.rolDeseado || payload?.Tipo || payload?.role || 'adoptante').toString().toLowerCase();
        return [
          { nombre, email, contrasena, aceptaTerminos: true, rolDeseado: rol },
          { Nombre: nombre, Email: email, Contrasena: contrasena, AceptaTerminos: true, Tipo: rol },
          { name: nombre, email, password: contrasena, role: rol }
        ];
      } catch { return [payload]; }
    }
  )();

  let lastError = null;

  for (const ep of endpoints) {
    for (const body of variants) {
      // Per attempt timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => { try { controller.abort(); } catch {} }, 6000);
      try {
        const data = await apiRequest(ep, { method: 'POST', body, signal: controller.signal });
        clearTimeout(timeout);
        if (data?.usuario || data?.token) {
          await fetchCurrentUser();
        } else {
          // Best-effort to refresh state if server set cookies
          try { await fetchCurrentUser(); } catch {}
        }
        return data;
      } catch (err) {
        clearTimeout(timeout);
        lastError = err;
        const status = err?.status || 0;
        const msg = String(err?.message || '').toLowerCase();
        // Stop on client errors (validation/duplicate email), keep trying on 5xx/network
        if (status >= 400 && status < 500 && !msg.includes('failed')) {
          throw err;
        }
        // continue on 5xx/timeout/fetch failures
      }
    }
  }
  // If all attempts failed, rethrow a friendly message preserving status if present
  const err = new Error(
    lastError?.message || 'No pudimos registrar tu cuenta (el servicio no responde). Intentá nuevamente en unos minutos.'
  );
  err.status = lastError?.status || 502;
  err.cause = lastError;
  throw err;
}

export async function loginUser(payload) {
  const endpoints = ['/api/auth/login', '/auth/login'];
  const buildVariants = () => {
    const email = payload?.email || payload?.Email || '';
    const contrasena = payload?.contrasena || payload?.Contrasena || payload?.password || '';
    return [
      { email, contrasena },
      { Email: email, Contrasena: contrasena },
      { email, password: contrasena }
    ];
  };
  const variants = buildVariants();
  let lastError = null;
  for (const ep of endpoints) {
    for (const body of variants) {
      const controller = new AbortController();
      const timeout = setTimeout(() => { try { controller.abort(); } catch {} }, 6000);
      try {
        const data = await apiRequest(ep, { method: 'POST', body, signal: controller.signal });
        clearTimeout(timeout);
        try {
          const user = data?.usuario || null;
          if (user) {
            const role = user?.Tipo ? String(user.Tipo).toLowerCase() : (user?.tipo ? String(user.tipo).toLowerCase() : 'public');
            setState({ user, role });
          } else {
            await fetchCurrentUser();
          }
        } catch (_) {
          await fetchCurrentUser();
        }
        return data;
      } catch (err) {
        clearTimeout(timeout);
        lastError = err;
        const status = err?.status || 0;
        // Para credenciales inválidas o cuenta no verificada, no seguir probando
        if (status === 401 || status === 403) {
          throw err;
        }
        // continuar con siguiente variante en 5xx/timeout/network
      }
    }
  }
  const error = new Error(lastError?.message || 'No se pudo iniciar sesión (el servicio no responde).');
  error.status = lastError?.status || 502;
  error.cause = lastError;
  throw error;
}

export async function logoutUser() {
  // Intenta cerrar sesión en el backend; si falla por red o método, 
  // garantizamos el sign-out local para no trabar la UI.
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    try {
      // Fallback defensivo: algunos entornos podrían bloquear POST sin body.
      await apiRequest('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'text/plain' } });
    } catch (_) {
      // Último recurso: ignora el error y continúa con sign-out local.
    }
  } finally {
    setState({ user: null, role: 'public' });
  }
}

export async function confirmEmail(token) {
  const data = await apiRequest(`/api/auth/confirmar?token=${encodeURIComponent(token)}`);
  await fetchCurrentUser();
  return data;
}

export async function updateRole(role) {
  const data = await apiRequest('/api/auth/promote', {
    method: 'POST',
    body: { Tipo: role }
  });
  await fetchCurrentUser();
  return data;
}

export function requireRole(roles) {
  const state = getState();
  if (!roles || roles.length === 0) return true;
  return roles.includes(state.role);
}
