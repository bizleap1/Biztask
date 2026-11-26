/**
 * Sprint 7 — Unified Reminder List, WhatsApp & Email Draft Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-min-32-chars-long!!';

const mockPrisma = vi.hoisted(() => ({
  task: {
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  dailyReport: {
    findMany: vi.fn(),
  },
  taskSubmission: {
    findMany: vi.fn(),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

vi.mock('../prismaClient', () => ({ default: mockPrisma }));

vi.mock('../middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    try {
      const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
      req.user = { id: decoded.id, role: decoded.role, tokenVersion: decoded.tv ?? 0 };
      next();
    } catch {
      return res.status(401).json({ message: 'Token invalid' });
    }
  },
  AuthRequest: {},
}));

import reminderRoutes from '../routes/reminderRoutes';

function makeToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/reminders', reminderRoutes);
  return app;
};

describe('Sprint 7 — Reminders & Manual Channels API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/reminders');
    expect(res.status).toBe(401);
  });

  it('rejects ClientUser role with 403', async () => {
    const app = buildApp();
    const token = makeToken({ id: 99, role: 'ClientUser' });
    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/reminders aggregates overdue tasks, missing reports, pending reviews, and corrections for Manager', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000);

    mockPrisma.task.findMany.mockResolvedValueOnce([
      {
        id: 10,
        title: 'Deploy API',
        deadline: pastDate,
        department: { name: 'Development' },
        assignedTo: { id: 5, name: 'Alice', email: 'alice@biz.com', phone: '919876543210', whatsappNumber: null },
      },
      {
        id: 11,
        title: 'Design Banner',
        deadline: futureDate,
        department: { name: 'Media' },
        assignedTo: { id: 6, name: 'Bob', email: 'bob@biz.com', phone: null, whatsappNumber: null },
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 5, name: 'Alice', email: 'alice@biz.com', phone: '919876543210', whatsappNumber: null },
      { id: 6, name: 'Bob', email: 'bob@biz.com', phone: null, whatsappNumber: null },
    ]);
    // Alice submitted today's report, Bob did not
    mockPrisma.dailyReport.findMany
      .mockResolvedValueOnce([{ userId: 5 }])
      .mockResolvedValueOnce([
        {
          id: 30,
          reportDate: pastDate,
          managerFeedback: 'Add PR links',
          user: { id: 5, name: 'Alice', email: 'alice@biz.com', phone: '919876543210', whatsappNumber: null },
        },
      ]);
    mockPrisma.taskSubmission.findMany.mockResolvedValueOnce([
      {
        id: 20,
        submittedAt: pastDate,
        task: { id: 10, title: 'Deploy API' },
        user: { id: 5, name: 'Alice', email: 'alice@biz.com', phone: null, whatsappNumber: null },
      },
    ]);

    const app = buildApp();
    const token = makeToken({ id: 2, role: 'Manager' });
    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      total: 5,
      high: 2,
      medium: 3,
      low: 0,
    });
    expect(res.body.reminders.map((r: { category: string }) => r.category)).toEqual([
      'overdue_task',
      'upcoming_task',
      'missing_daily_report',
      'pending_review',
      'report_correction',
    ]);
  });

  it('GET /api/reminders scopes data for Employee and skips pending reviews', async () => {
    mockPrisma.task.findMany.mockResolvedValueOnce([]);
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 5, name: 'Alice', email: 'alice@biz.com', phone: null, whatsappNumber: null },
    ]);
    mockPrisma.dailyReport.findMany
      .mockResolvedValueOnce([{ userId: 5 }])
      .mockResolvedValueOnce([]);

    const app = buildApp();
    const token = makeToken({ id: 5, role: 'Employee' });
    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.taskSubmission.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedToId: 5 }),
      })
    );
  });

  it('GET /api/reminders/templates returns reminder templates', async () => {
    const app = buildApp();
    const token = makeToken({ id: 1, role: 'SuperAdmin' });
    const res = await request(app)
      .get('/api/reminders/templates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(5);
  });

  it('POST /api/reminders/whatsapp-link builds wa.me URL and logs activity', async () => {
    const app = buildApp();
    const token = makeToken({ id: 1, role: 'SuperAdmin' });
    const res = await request(app)
      .post('/api/reminders/whatsapp-link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        phone: '+91 98765-43210',
        templateKey: 'overdue_task',
        variables: { name: 'Alice', taskTitle: 'Deploy API', dueDate: '2026-11-25' },
      });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('919876543210');
    expect(res.body.url).toContain('https://wa.me/919876543210?text=');
    expect(res.body.message).toContain('Deploy API');
    expect(mockPrisma.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it('POST /api/reminders/whatsapp-link returns 400 on missing/invalid phone', async () => {
    const app = buildApp();
    const token = makeToken({ id: 1, role: 'SuperAdmin' });
    const res = await request(app)
      .post('/api/reminders/whatsapp-link')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: 'abc', templateKey: 'missing_daily_report' });

    expect(res.status).toBe(400);
  });

  it('POST /api/reminders/email-draft builds mailto & Gmail compose URLs', async () => {
    const app = buildApp();
    const token = makeToken({ id: 2, role: 'Manager' });
    const res = await request(app)
      .post('/api/reminders/email-draft')
      .set('Authorization', `Bearer ${token}`)
      .send({
        to: 'alice@biz.com',
        templateKey: 'upcoming_task',
        variables: { name: 'Alice', taskTitle: 'Design Review', dueDate: '2026-11-27' },
      });

    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Upcoming Deadline: Design Review');
    expect(res.body.mailtoUrl).toContain('mailto:alice%40biz.com');
    expect(res.body.gmailComposeUrl).toContain('https://mail.google.com/mail/?view=cm&fs=1');
    expect(mockPrisma.activityLog.create).toHaveBeenCalledTimes(1);
  });
});
