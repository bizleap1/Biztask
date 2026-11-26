import api from './api';

export interface ContentItem {
  id: number;
  calendarId: number;
  scheduledDate: string;
  platform: string;
  postType: string;
  topic: string;
  content: string;
  objective?: string | null;
  visualIdea?: string | null;
  hashtags?: string | null;
  status: 'Draft' | 'Approved' | 'Rejected' | 'ConvertedToTask';
  reviewNotes?: string | null;
  taskId?: number | null;
  task?: { id: number; title: string; status: string } | null;
  aiGenerated: boolean;
  createdAt: string;
}

export interface ContentCalendar {
  id: number;
  title: string;
  month: number;
  year: number;
  clientId: number;
  client: { id: number; name: string; companyName?: string | null };
  createdById: number;
  createdBy: { id: number; name: string };
  status: 'Draft' | 'Active' | 'Completed' | 'Archived';
  notes?: string | null;
  items?: ContentItem[];
  _count?: { items: number };
  createdAt: string;
}

export const contentCalendarService = {
  getCalendars: async (params?: { clientId?: number; month?: number; year?: number; status?: string }) => {
    const res = await api.get<{ calendars: ContentCalendar[] }>('/content-calendars', { params });
    return res.data.calendars;
  },

  getCalendarById: async (id: number) => {
    const res = await api.get<{ calendar: ContentCalendar }>('/content-calendars/' + id);
    return res.data.calendar;
  },

  createCalendar: async (data: { title: string; month: number; year: number; clientId: number; notes?: string }) => {
    const res = await api.post<{ calendar: ContentCalendar }>('/content-calendars', data);
    return res.data.calendar;
  },

  updateCalendar: async (id: number, data: Partial<{ title: string; status: string; notes: string }>) => {
    const res = await api.put<{ calendar: ContentCalendar }>('/content-calendars/' + id, data);
    return res.data.calendar;
  },

  deleteCalendar: async (id: number) => {
    const res = await api.delete('/content-calendars/' + id);
    return res.data;
  },

  addItem: async (calendarId: number, data: {
    scheduledDate: string;
    platform: string;
    postType: string;
    topic: string;
    content: string;
    objective?: string;
    visualIdea?: string;
    hashtags?: string;
  }) => {
    const res = await api.post<{ item: ContentItem }>('/content-calendars/' + calendarId + '/items', data);
    return res.data.item;
  },

  updateItem: async (calendarId: number, itemId: number, data: Partial<ContentItem>) => {
    const res = await api.put<{ item: ContentItem }>('/content-calendars/' + calendarId + '/items/' + itemId, data);
    return res.data.item;
  },

  deleteItem: async (calendarId: number, itemId: number) => {
    const res = await api.delete('/content-calendars/' + calendarId + '/items/' + itemId);
    return res.data;
  },

  approveItem: async (calendarId: number, itemId: number, reviewNotes?: string) => {
    const res = await api.patch<{ item: ContentItem }>('/content-calendars/' + calendarId + '/items/' + itemId + '/approve', { reviewNotes });
    return res.data.item;
  },

  rejectItem: async (calendarId: number, itemId: number, reviewNotes?: string) => {
    const res = await api.patch<{ item: ContentItem }>('/content-calendars/' + calendarId + '/items/' + itemId + '/reject', { reviewNotes });
    return res.data.item;
  },

  convertToTask: async (calendarId: number, itemId: number, data: {
    departmentId: number;
    assignedToId?: number;
    priority?: string;
  }) => {
    const res = await api.post<{ task: { id: number; title: string }; item: { id: number; status: string; taskId: number } }>(
      '/content-calendars/' + calendarId + '/items/' + itemId + '/convert-to-task',
      data
    );
    return res.data;
  },

  generateAiItems: async (calendarId: number, data: {
    numPosts: number;
    platforms: string[];
    promotionDetails?: string;
  }) => {
    const res = await api.post<{ message: string; items: ContentItem[] }>('/content-calendars/' + calendarId + '/generate', data);
    return res.data;
  },

  exportCalendar: async (id: number) => {
    const res = await api.get<{ export: unknown }>('/content-calendars/' + id + '/export');
    return res.data.export;
  }
};
