import api from './api';

export const meetingService = {
  getMeetings: async (view?: 'today' | 'next7') =>
    (await api.get('/meetings', { params: view ? { view } : undefined })).data,
  getMeeting: async (id: number) => (await api.get(`/meetings/${id}`)).data,
  createMeeting: async (payload: any) => (await api.post('/meetings', payload)).data,
  updateMeeting: async (id: number, payload: any) => (await api.put(`/meetings/${id}`, payload)).data,
  saveMinutes: async (id: number, content: string) =>
    (await api.post(`/meetings/${id}/minutes`, { content })).data,
  addActionItem: async (id: number, payload: any) =>
    (await api.post(`/meetings/${id}/action-items`, payload)).data,
  convertActionItem: async (id: number, itemId: number) =>
    (await api.post(`/meetings/${id}/action-items/${itemId}/convert`)).data
};
