import { apiRequest } from './apiClient.js';

export async function createVisit(payload) {
  return apiRequest('/api/visitas', {
    method: 'POST',
    body: payload
  });
}

export async function updateVisit(id, payload) {
  return apiRequest(`/api/visitas/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function cancelVisit(id, payload = {}) {
  return apiRequest(`/api/visitas/${id}/cancelar`, {
    method: 'POST',
    body: payload
  });
}

export async function listAllVisits() {
  try {
    const data = await apiRequest('/api/visitas');
    return data?.visitas || [];
  } catch (err) {
    const status = err?.status || 0;
    const msg = String(err?.message || '').toLowerCase();
    if (status >= 500 || msg.includes('failed to respond') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      console.warn('[visitsService] API 5xx; usando lista vacía temporal');
      return [];
    }
    throw err;
  }
}

// Adoptante: visitas propias
export async function listMyVisits() {
  const data = await apiRequest('/api/visitas/mias');
  return data?.visitas || [];
}

// Adoptante: crear solicitud de visita (estado Pendiente)
export async function createMyVisitRequest(payload) {
  const body = { ...(payload || {}) };
  // Normalizar ids a número cuando sea posible
  try { if (body.SolicitudId) body.SolicitudId = Number(body.SolicitudId); } catch {}
  try { if (body.AnimalId) body.AnimalId = Number(body.AnimalId); } catch {}
  return apiRequest('/api/visitas/solicitudes', {
    method: 'POST',
    body,
  });
}

export async function confirmMyVisit(id) {
  return apiRequest(`/api/visitas/${id}/confirmar-asistencia`, { method: 'POST' });
}

export async function requestMyVisitChange(id, payload = {}) {
  return apiRequest(`/api/visitas/${id}/solicitar-cambio`, { method: 'POST', body: payload });
}
