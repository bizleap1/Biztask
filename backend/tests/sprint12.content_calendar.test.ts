/**
 * Sprint 12 — Content Calendar AI Tests (F07)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

process.env.JWT_SECRET = 'test_super_secret_key_for_vitest_suite_32chars';

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify([
          {
            date: '2027-01-10',
            platform: 'Instagram',
            type: 'Reel',
            topic: 'New Year Tips',
            content: 'Tips for growing your business in the new year',
            objective: 'Brand Awareness',
            visualIdea: 'Quick cuts video'
          }
        ])
      })
    }
  })),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY' }
}));

import request from 'supertest';
import app from '../index';
import jwt from 'jsonwebtoken';

// ─── Mock Prisma ─────────────────────────────────────────────────────────────
vi.mock('../prismaClient', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: number } }) => {
        if (where.id === 1) return Promise.resolve({ id: 1, name: 'Admin', role: 'SuperAdmin', isActive: true, tokenVersion: 0 });
        if (where.id === 2) return Promise.resolve({ id: 2, name: 'Emp', role: 'Employee', isActive: true, tokenVersion: 0 });
        return Promise.resolve(null);
      })
    },
    contentCalendar: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    contentItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    task: { create: vi.fn() },
    activityLog: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    notification: { create: vi.fn().mockResolvedValue({ id: 1 }) }
  };
  return { default: mockPrisma };
});

import prisma from '../prismaClient';

const mockPrisma = prisma as unknown as {
  contentCalendar: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  contentItem: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  task: { create: ReturnType<typeof vi.fn> };
};

const SECRET = process.env.JWT_SECRET || 'test-secret';
const adminToken = jwt.sign({ id: 1, role: 'SuperAdmin', tokenVersion: 0 }, SECRET);
const empToken = jwt.sign({ id: 2, role: 'Employee', tokenVersion: 0 }, SECRET);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Sprint 12 — Content Calendar AI', () => {
  // T12-01: List calendars
  it('T12-01: GET /api/content-calendars returns list', async () => {
    mockPrisma.contentCalendar.findMany.mockResolvedValue([
      { id: 1, title: 'Jan Calendar', month: 1, year: 2027, client: { id: 1, name: 'Acme' }, _count: { items: 5 } }
    ]);

    const res = await request(app)
      .get('/api/content-calendars')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.calendars).toHaveLength(1);
    expect(res.body.calendars[0].title).toBe('Jan Calendar');
  });

  // T12-02: Create calendar
  it('T12-02: POST /api/content-calendars creates calendar', async () => {
    mockPrisma.contentCalendar.findUnique.mockResolvedValue(null);
    mockPrisma.contentCalendar.create.mockResolvedValue({
      id: 2, title: 'Feb Calendar', month: 2, year: 2027,
      clientId: 1, client: { id: 1, name: 'Acme' }, createdBy: { id: 1, name: 'Admin' }
    });

    const res = await request(app)
      .post('/api/content-calendars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Feb Calendar', month: 2, year: 2027, clientId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.calendar.title).toBe('Feb Calendar');
  });

  // T12-03: Employee cannot create calendar
  it('T12-03: Employee cannot create calendar', async () => {
    const res = await request(app)
      .post('/api/content-calendars')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ title: 'Test', month: 1, year: 2027, clientId: 1 });

    expect(res.status).toBe(403);
  });

  // T12-04: Add item to calendar
  it('T12-04: POST /:id/items adds content item', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue({ id: 1, isDeleted: false });
    mockPrisma.contentItem.create.mockResolvedValue({
      id: 1, calendarId: 1, topic: 'Holiday Sale', platform: 'Instagram', postType: 'Reel',
      status: 'Draft', aiGenerated: false
    });

    const res = await request(app)
      .post('/api/content-calendars/1/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scheduledDate: '2027-01-15', platform: 'Instagram', postType: 'Reel',
        topic: 'Holiday Sale', content: 'Post about holiday sale'
      });

    expect(res.status).toBe(201);
    expect(res.body.item.topic).toBe('Holiday Sale');
  });

  // T12-05: Approve item
  it('T12-05: PATCH approve sets status to Approved', async () => {
    mockPrisma.contentItem.findFirst.mockResolvedValue({
      id: 1, status: 'Draft', topic: 'Sale Post', createdById: 2, isDeleted: false
    });
    mockPrisma.contentItem.update.mockResolvedValue({
      id: 1, status: 'Approved', reviewNotes: 'Looks great'
    });

    const res = await request(app)
      .patch('/api/content-calendars/1/items/1/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewNotes: 'Looks great' });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('Approved');
  });

  // T12-06: Reject item
  it('T12-06: PATCH reject sets status to Rejected', async () => {
    mockPrisma.contentItem.findFirst.mockResolvedValue({
      id: 2, status: 'Draft', topic: 'Bad Post', createdById: 2, isDeleted: false
    });
    mockPrisma.contentItem.update.mockResolvedValue({
      id: 2, status: 'Rejected', reviewNotes: 'Needs rework'
    });

    const res = await request(app)
      .patch('/api/content-calendars/1/items/2/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewNotes: 'Needs rework' });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('Rejected');
  });

  // T12-07: Convert approved item to task
  it('T12-07: POST convert-to-task creates task from approved item', async () => {
    mockPrisma.contentItem.findFirst.mockResolvedValue({
      id: 3, status: 'Approved', topic: 'Promo Post', taskId: null, platform: 'Instagram',
      postType: 'Carousel', content: 'Promo details', scheduledDate: new Date('2027-01-20'),
      visualIdea: 'Use brand colors', hashtags: '#promo', isDeleted: false, createdById: 2,
      calendar: { clientId: 1, client: { name: 'Acme' } }
    });
    mockPrisma.task.create.mockResolvedValue({
      id: 100, title: '[Content] Promo Post', status: 'Pending'
    });
    mockPrisma.contentItem.update.mockResolvedValue({
      id: 3, status: 'ConvertedToTask', taskId: 100
    });

    const res = await request(app)
      .post('/api/content-calendars/1/items/3/convert-to-task')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: 2 });

    expect(res.status).toBe(201);
    expect(res.body.task.id).toBe(100);
    expect(res.body.item.status).toBe('ConvertedToTask');
  });

  // T12-08: Cannot convert non-approved item
  it('T12-08: convert-to-task rejects Draft items', async () => {
    mockPrisma.contentItem.findFirst.mockResolvedValue({
      id: 4, status: 'Draft', topic: 'Draft Post', taskId: null, isDeleted: false,
      calendar: { clientId: 1, client: { name: 'Acme' } }
    });

    const res = await request(app)
      .post('/api/content-calendars/1/items/4/convert-to-task')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: 2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('approved');
  });

  // T12-09: Export calendar data
  it('T12-09: GET /:id/export returns export-ready data', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue({
      id: 1, title: 'Jan Cal', month: 1, year: 2027, status: 'Active',
      notes: 'Focus on engagement',
      client: { id: 1, name: 'Acme', companyName: 'Acme Corp' },
      createdBy: { id: 1, name: 'Admin' },
      items: [
        {
          scheduledDate: new Date('2027-01-10'), platform: 'Instagram', postType: 'Reel',
          topic: 'New Year', content: 'Happy New Year', objective: 'Engagement',
          visualIdea: 'Fireworks', hashtags: '#NewYear', status: 'Approved', aiGenerated: true
        }
      ]
    });

    const res = await request(app)
      .get('/api/content-calendars/1/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.export.title).toBe('Jan Cal');
    expect(res.body.export.items).toHaveLength(1);
    expect(res.body.export.period).toBe('January 2027');
  });

  // T12-10: Unauthenticated request returns 401
  it('T12-10: unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/content-calendars');
    expect(res.status).toBe(401);
  });
});
