import api from './api';
export const financeService = {
  getInvoices: async () => (await api.get('/finance/invoices')).data,
  createInvoice: async (payload: any) => (await api.post('/finance/invoices', payload)).data,
  issueInvoice: async (id: number) => (await api.post(`/finance/invoices/${id}/issue`)).data,
  addReceipt: async (id: number, payload: any) => (await api.post(`/finance/invoices/${id}/receipts`, payload)).data
};
