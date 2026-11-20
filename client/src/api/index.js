import apiClient from './apiClient';

export const propertiesApi = {
  getAll: () => apiClient.get('/properties').then(r => r.data),
  getById: (id) => apiClient.get(`/properties/${id}`).then(r => r.data),
};

export const reviewsApi = {
  getReviews: (params = {}) => apiClient.get('/reviews', { params }).then(r => r.data),
  getById: (id) => apiClient.get(`/reviews/${id}`).then(r => r.data),
  reanalyze: (id) => apiClient.post(`/reviews/${id}/reanalyze`).then(r => r.data),
  recordCorrection: (id, payload) => apiClient.patch(`/reviews/${id}/correction`, payload).then(r => r.data),
  importCsvPreview: (formData) => apiClient.post('/import/csv/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  importCsv: (formData) => apiClient.post('/reviews/import/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  importJson: (formDataOrJson) => {
    if (formDataOrJson instanceof FormData) {
      return apiClient.post('/reviews/import/json', formDataOrJson, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    }
    return apiClient.post('/reviews/import/json', formDataOrJson).then(r => r.data);
  },
};

export const analyticsApi = {
  getOverview: (params = {}) => apiClient.get('/analytics/overview', { params }).then(r => r.data),
  getProperties: () => apiClient.get('/analytics/properties').then(r => r.data),
  getTrends: (params = {}) => apiClient.get('/analytics/trends', { params }).then(r => r.data),
  getTopics: () => apiClient.get('/analytics/topics').then(r => r.data),
  getSentiment: () => apiClient.get('/analytics/sentiment').then(r => r.data),
};

export const insightsApi = {
  getAll: (params = {}) => apiClient.get('/insights', { params }).then(r => r.data),
  getEvidence: (id) => apiClient.get(`/insights/${id}/evidence`).then(r => r.data),
};

export const collectionApi = {
  getStatus: () => apiClient.get('/collection/status').then(r => r.data),
  getJobs: () => apiClient.get('/collection/jobs').then(r => r.data),
  runJob: (jobName, payload = {}) => apiClient.post(`/collection/jobs/${jobName}/run`, payload).then(r => r.data),
  toggleJob: (jobName, active) => apiClient.post(`/collection/jobs/${jobName}/toggle`, { active }).then(r => r.data),
  getQueue: () => apiClient.get('/collection/queue').then(r => r.data),
  processQueue: (payload = {}) => apiClient.post('/collection/queue/process', payload).then(r => r.data),
  getLogs: (params = {}) => apiClient.get('/collection/logs', { params }).then(r => r.data),
  runCollection: (payload = {}) => apiClient.post('/collection/run', payload).then(r => r.data),
  crawl: (payload = {}) => apiClient.post('/collection/crawl', payload).then(r => r.data),
};

export const reportsApi = {
  getWeekly: (params = {}) => apiClient.get('/reports/weekly', { params }).then(r => r.data),
  generateWeekly: (payload = {}) => apiClient.post('/reports/weekly/generate', payload).then(r => r.data),
};

export const importApi = {
  getAdapters: () => apiClient.get('/import/adapters').then(r => r.data),
  previewCsv: (formData) => apiClient.post('/import/csv/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  importCsv: (formData) => apiClient.post('/reviews/import/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  importJson: (formDataOrJson) => {
    if (formDataOrJson instanceof FormData) {
      return apiClient.post('/reviews/import/json', formDataOrJson, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data);
    }
    return apiClient.post('/reviews/import/json', formDataOrJson).then(r => r.data);
  },
  generateSynthetic: (count = 50) => apiClient.post('/import/synthetic', { count }).then(r => r.data),
};

export const systemApi = {
  getHealth: () => apiClient.get('/health').then(r => r.data),
};
