import api from './api';

export const portalService = {
  getOverview: async () => (await api.get('/portal/overview')).data,
  getTasks: async () => (await api.get('/portal/tasks')).data,
  getTask: async (id: number) => (await api.get(`/portal/tasks/${id}`)).data
};
