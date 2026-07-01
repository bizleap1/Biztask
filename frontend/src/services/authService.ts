import api from './api';

export const authService = {
  changePassword: async (data: any) => {
    const response = await api.post('/auth/change-password', data);
    return response.data;
  }
};
