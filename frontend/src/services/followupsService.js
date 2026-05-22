import { apiRequest } from './apiClient.js';

export async function createFollowUp(payload) {
  return apiRequest('/api/seguimientos', {
    method: 'POST',
    body: payload
  });
}

export async function updateFollowUp(id, payload) {
  return apiRequest(`/api/seguimientos/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function cancelFollowUp(id, payload = {}) {
  return apiRequest(`/api/seguimientos/${id}/cancelar`, {
    method: 'POST',
    body: payload
  });
}

// Operador/veterinario: listar todos los seguimientos
export async function listAllFollowUps() {
  try {
    const data = await apiRequest('/api/seguimientos');
    return data?.seguimientos || [];
  } catch (err) {
    const status = err?.status || 0;
    const msg = String(err?.message || '').toLowerCase();
    if (status >= 500 || msg.includes('failed to respond') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      console.warn('[followupsService] API 5xx; usando lista vacía temporal');
      return [];
    }
    throw err;
  }
}

// Adoptante: seguimientos propios
export async function listMyFollowUps() {
  const data = await apiRequest('/api/seguimientos/mios');
  return data?.seguimientos || [];
}

export async function createMyFollowUp(payload) {
  return apiRequest('/api/seguimientos/mios', {
    method: 'POST',
    body: payload
  });
}

export async function updateMyFollowUp(id, payload) {
  return apiRequest(`/api/seguimientos/mios/${id}`, {
    method: 'PUT',
    body: payload
  });
}

// Público: seguimientos asociados a un animal (para ficha)
export async function listFollowUpsForAnimal(animalId) {
  const data = await apiRequest(`/api/seguimientos/por-animal?animalId=${encodeURIComponent(animalId)}`);
  return data?.seguimientos || [];
}

export async function ensureSolicitudForAnimal(animalId) {
  if (!animalId) {
    const err = new Error('animalId requerido');
    err.status = 400;
    throw err;
  }
  const data = await apiRequest('/api/seguimientos/solicitud-por-animal', {
    method: 'POST',
    body: { AnimalId: animalId }
  });
  return data?.solicitud || null;
}
