import { apiRequest } from './apiClient.js';

export async function createControl(payload, { headers } = {}) {
  return apiRequest('/api/controles', {
    method: 'POST',
    body: payload,
    headers
  });
}

export async function listControls(animalId) {
  const data = await apiRequest(`/api/controles?animalId=${encodeURIComponent(animalId)}`);
  return data?.controles || [];
}
