import api from './api';

export const submissionService = {
  getPendingSubmissions: async (filters?: any) => {
    const response = await api.get('/submissions/pending', { params: filters });
    return response.data;
  },

  approveSubmission: async (id: number) => {
    const response = await api.patch(`/submissions/${id}/approve`);
    return response.data;
  },

  rejectSubmission: async (id: number, managerFeedback: string) => {
    const response = await api.patch(`/submissions/${id}/reject`, { managerFeedback });
    return response.data;
  },

  deleteSubmission: async (id: number) => {
    const response = await api.delete(`/submissions/${id}`);
    return response.data;
  },

  bulkDeleteSubmissions: async (ids: number[]) => {
    const response = await api.delete('/submissions/bulk', { data: { ids } });
    return response.data;
  }
};
