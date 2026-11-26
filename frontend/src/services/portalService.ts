import api from './api';

export const portalService = {
  getOverview: async () => (await api.get('/portal/overview')).data,
  getTasks: async () => (await api.get('/portal/tasks')).data,
  getTask: async (id: number) => (await api.get(`/portal/tasks/${id}`)).data,
  approveTask: async (id: number, status: 'Approved' | 'Rejected') =>
    (await api.post(`/portal/tasks/${id}/approval`, { status })).data,
  getInvoices: async () => (await api.get('/portal/invoices')).data,
  getReports: async () => (await api.get('/portal/reports')).data,
  getRequests: async () => (await api.get('/portal/requests')).data,
  createRequest: async (payload: any) => (await api.post('/portal/requests', payload)).data
};
