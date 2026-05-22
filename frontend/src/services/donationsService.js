import { apiRequest } from './apiClient.js';

export const DONATION_ENDPOINT = '/api/donaciones';

export async function createDonation(payload) {
  // TODO: Confirmar endpoint definitivo con el backend.
  return apiRequest(DONATION_ENDPOINT, {
    method: 'POST',
    body: payload
  });
}