import api from './api';

export const dailyReportService = {
  submitReport: async (data: any) => {
    const response = await api.post('/daily-reports', data);
    return response.data;
  },

  getAllReports: async (filters: any = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/daily-reports?${params}`);
    return response.data;
  },

  getMyReports: async () => {
    const response = await api.get('/daily-reports/my');
    return response.data;
  },

  getReportById: async (id: number) => {
    const response = await api.get(`/daily-reports/${id}`);
    return response.data;
  },

  updateReport: async (id: number, data: any) => {
    const response = await api.put(`/daily-reports/${id}`, data);
    return response.data;
  },

  reviewReport: async (id: number, managerFeedback?: string) => {
    const response = await api.patch(`/daily-reports/${id}/review`, { managerFeedback });
    return response.data;
  },

  markNeedsCorrection: async (id: number, managerFeedback: string) => {
    const response = await api.patch(`/daily-reports/${id}/needs-correction`, { managerFeedback });
    return response.data;
  },

  deleteReport: async (id: number) => {
    const response = await api.delete(`/daily-reports/${id}`);
    return response.data;
  },

  bulkDeleteReports: async (ids: number[]) => {
    const response = await api.delete('/daily-reports/bulk', { data: { ids } });
    return response.data;
  }
};
