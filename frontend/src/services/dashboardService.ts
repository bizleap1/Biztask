import api from './api';

export const dashboardService = {
  getAdminDashboard: async (filters: { startDate?: string, endDate?: string, department?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.department) params.append('department', filters.department);
    
    const response = await api.get(`/dashboard/admin?${params.toString()}`);
    return response.data;
  },

  getManagerDashboard: async (filters: { startDate?: string, endDate?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    const response = await api.get(`/dashboard/manager?${params.toString()}`);
    return response.data;
  },

  getEmployeeDashboard: async (filters: { startDate?: string, endDate?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    const response = await api.get(`/dashboard/employee?${params.toString()}`);
    return response.data;
  },

  getHrDashboard: async () => {
    const response = await api.get('/dashboard/hr');
    return response.data;
  }
};
