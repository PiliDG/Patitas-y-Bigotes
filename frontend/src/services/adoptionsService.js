import { apiRequest } from './apiClient.js';

export async function createApplication(payload) {
  return apiRequest('/api/solicitudes', {
    method: 'POST',
    body: payload
  });
}

export async function listMyApplications() {
  const data = await apiRequest('/api/solicitudes');
  return data?.solicitudes || [];
}

// Operador: lista todas las solicitudes
export async function listAllApplications() {
  try {
    const data = await apiRequest('/api/solicitudes/todas');
    return data?.solicitudes || [];
  } catch (err) {
    const status = err?.status || 0;
    const msg = String(err?.message || '').toLowerCase();
    if (status >= 500 || msg.includes('failed to respond') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      console.warn('[adoptionsService] API 5xx; usando lista vacía temporal');
      return [];
    }
    throw err;
  }
}

export async function updateApplication(id, payload) {
  return apiRequest(`/api/solicitudes/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function cancelApplication(id, payload) {
  return apiRequest(`/api/solicitudes/${id}/cancelar`, {
    method: 'POST',
    body: payload
  });
}

export async function setUnderReview(id, payload = {}) {
  return apiRequest(`/api/solicitudes/${id}/poner-en-revision`, { method: 'POST', body: payload });
}

export async function approveApplication(id) {
  return apiRequest(`/api/solicitudes/${id}/aprobar`, { method: 'POST' });
}

// Unificado: cerrar solicitud (rechazar | anular)
export async function closeApplication(id, payload) {
  return apiRequest(`/api/solicitudes/${id}/cerrar`, {
    method: 'POST',
    body: payload
  });
}

export async function rejectApplication(id, payload) {
  // Wrapper hacia endpoint unificado
  return closeApplication(id, { Accion: 'rechazar', ...(payload || {}) });
}

export async function voidApplication(id, payload) {
  // Wrapper hacia endpoint unificado
  return closeApplication(id, { Accion: 'anular', ...(payload || {}) });
}
