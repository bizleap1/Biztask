import api from './api';

export const activityLogService = {
  getActivityLogs: async (params?: any) => {
    const response = await api.get('/activity-logs', { params });
    return response.data;
  },
  getMyActivityLogs: async () => {
    const response = await api.get('/activity-logs/my');
    return response.data;
  }
};
