import apiClient from './apiClient';

/**
 * Health API — queries the backend health endpoints.
 */
export const healthApi = {
  /**
   * Full health check including DB and AI worker status.
   */
  getHealth: () => apiClient.get('/health').then((r) => r.data),

  /**
   * Lightweight liveness probe.
   */
  ping: () => apiClient.get('/health/ping').then((r) => r.data),
};

