import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request Interceptor ────────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // Attach a request ID for tracing
    config.headers['X-Request-ID'] = crypto.randomUUID();
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ───────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with a non-2xx status
      const { status, data } = error.response;
      const message = data?.error?.message || `Server error: ${status}`;
      const enhancedError = new Error(message);
      enhancedError.statusCode = status;
      enhancedError.code = data?.error?.code || 'API_ERROR';
      enhancedError.originalError = error;
      return Promise.reject(enhancedError);
    } else if (error.request) {
      // Request was sent but no response received (network issue)
      const networkError = new Error('Cannot reach the server. Check your connection.');
      networkError.code = 'NETWORK_ERROR';
      return Promise.reject(networkError);
    }
    return Promise.reject(error);
  }
);

export default apiClient;

