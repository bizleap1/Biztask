import api from './api';

export const crmService = {
  getLeads: async (all = false) => (await api.get('/crm/leads', { params: all ? { all: 'true' } : undefined })).data,
  getLead: async (id: number) => (await api.get(`/crm/leads/${id}`)).data,
  createLead: async (payload: any) => (await api.post('/crm/leads', payload)).data,
  updateLead: async (id: number, payload: any) => (await api.put(`/crm/leads/${id}`, payload)).data,
  addActivity: async (id: number, payload: any) => (await api.post(`/crm/leads/${id}/activities`, payload)).data,
  convertLead: async (id: number) => (await api.post(`/crm/leads/${id}/convert`)).data
};
