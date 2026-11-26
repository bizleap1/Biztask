import api from './api';
export const attendanceService = {
  checkIn: async () => (await api.post('/attendance/check-in')).data,
  checkOut: async () => (await api.post('/attendance/check-out')).data,
  getAttendance: async () => (await api.get('/attendance')).data,
  getLeave: async () => (await api.get('/attendance/leave')).data,
  requestLeave: async (payload: any) => (await api.post('/attendance/leave', payload)).data,
  decideLeave: async (id: number, status: 'Approved'|'Rejected') => (await api.post(`/attendance/leave/${id}/decision`, { status })).data
};
