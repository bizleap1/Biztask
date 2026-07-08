import api from './api';

export const userService = {
  getUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  
  getDepartments: async () => {
    const response = await api.get('/users/departments');
    return response.data;
  },
  
  getUserById: async (id: number) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  
  createUser: async (userData: any) => {
    const response = await api.post('/users', userData);
    return response.data;
  },
  
  updateUser: async (id: number, userData: any) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  
  deactivateUser: async (id: number) => {
    const response = await api.patch(`/users/${id}/deactivate`);
    return response.data;
  },
  
  activateUser: async (id: number) => {
    const response = await api.patch(`/users/${id}/activate`);
    return response.data;
  },
  
  deleteUser: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  }
};
