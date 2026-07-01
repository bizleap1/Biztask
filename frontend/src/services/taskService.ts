import api from './api';

export const taskService = {
  createTask: async (taskData: any) => {
    const response = await api.post('/tasks', taskData);
    return response.data;
  },

  getTasks: async (filters?: any) => {
    const response = await api.get('/tasks', { params: filters });
    return response.data;
  },

  getMyTasks: async (filters?: any) => {
    const response = await api.get('/tasks/my', { params: filters });
    return response.data;
  },

  getTaskById: async (id: number) => {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  updateTask: async (id: number, taskData: any) => {
    const response = await api.put(`/tasks/${id}`, taskData);
    return response.data;
  },

  updateTaskStatus: async (id: number, status: string) => {
    const response = await api.patch(`/tasks/${id}/status`, { status });
    return response.data;
  },

  deleteTask: async (id: number) => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },

  submitTask: async (id: number, submissionData: any) => {
    const response = await api.post(`/tasks/${id}/submit`, submissionData);
    return response.data;
  }
};
