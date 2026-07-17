import api from './api';

export const activityLogService = {
  getActivityLogs: async (params?: any) => {
    const response = await api.get('/activity-logs', { params });
    return response.data;
  },
  getMyActivityLogs: async () => {
    const response = await api.get('/activity-logs/my');
    return response.data;
  },
  deleteActivityLog: async (id: number) => {
    const response = await api.delete(`/activity-logs/${id}`);
    return response.data;
  },
  bulkDeleteActivityLogs: async (ids: number[]) => {
    const response = await api.delete('/activity-logs/bulk', { data: { ids } });
    return response.data;
  }
};
