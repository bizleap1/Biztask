/**
 * Sprint 4 — Analytics Dashboard Tests
 * Tests RBAC enforcement and aggregate responses for /api/analytics/* endpoints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-min-32-chars-long!!';

const mockPrisma = vi.hoisted(() => ({
  user: {
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  task: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  taskSubmission: {
    count: vi.fn(),
  },
  department: {
    findMany: vi.fn(),
  },
  activityLog: {
    findMany: vi.fn(),
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

import analyticsRoutes from '../routes/analyticsRoutes';

function makeToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRoutes);
  return app;
};

describe('Sprint 4 — Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/analytics/overview');
    expect(res.status).toBe(401);
  });

  it('rejects Employee role with 403', async () => {
    const app = buildApp();
    const token = makeToken({ id: 3, role: 'Employee' });
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/analytics/overview returns aggregated counts for SuperAdmin', async () => {
    mockPrisma.user.count.mockResolvedValueOnce(12).mockResolvedValueOnce(10);
    mockPrisma.task.count
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(12);
    mockPrisma.taskSubmission.count.mockResolvedValueOnce(8);

    const app = buildApp();
    const token = makeToken({ id: 1, role: 'SuperAdmin' });
    const res = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalUsers: 12,
      activeUsers: 10,
      totalTasks: 40,
      completedTasks: 25,
      pendingTasks: 12,
      recentSubmissions: 8,
    });
  });

  it('GET /api/analytics/tasks returns department metrics and status breakdown for Manager', async () => {
    const created = new Date('2026-11-20T08:00:00.000Z');
    const updated = new Date('2026-11-20T14:00:00.000Z');

    mockPrisma.department.findMany.mockResolvedValueOnce([
      { id: 1, name: 'Development' },
      { id: 2, name: 'Media' },
    ]);
    mockPrisma.task.groupBy
      .mockResolvedValueOnce([
        { departmentId: 1, status: 'Approved', _count: { id: 4 } },
        { departmentId: 1, status: 'Pending', _count: { id: 2 } },
        { departmentId: 2, status: 'In Progress', _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([
        { status: 'Approved', _count: { id: 4 } },
        { status: 'Pending', _count: { id: 2 } },
        { status: 'In Progress', _count: { id: 3 } },
      ]);
    mockPrisma.task.findMany.mockResolvedValueOnce([
      { departmentId: 1, createdAt: created, updatedAt: updated },
    ]);

    const app = buildApp();
    const token = makeToken({ id: 2, role: 'Manager' });
    const res = await request(app)
      .get('/api/analytics/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.byDepartment).toEqual([
      {
        departmentId: 1,
        departmentName: 'Development',
        totalTasks: 6,
        completedTasks: 4,
        pendingTasks: 2,
        avgCompletionHours: 6,
      },
      {
        departmentId: 2,
        departmentName: 'Media',
        totalTasks: 3,
        completedTasks: 0,
        pendingTasks: 3,
        avgCompletionHours: 0,
      },
    ]);
    expect(res.body.statusBreakdown).toHaveLength(3);
  });

  it('GET /api/analytics/users returns 14-day logins and role distribution', async () => {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    mockPrisma.activityLog.findMany.mockResolvedValueOnce([
      { createdAt: today },
      { createdAt: today },
    ]);
    mockPrisma.user.groupBy.mockResolvedValueOnce([
      { role: 'SuperAdmin', _count: { id: 1 } },
      { role: 'Manager', _count: { id: 2 } },
      { role: 'Employee', _count: { id: 7 } },
    ]);

    const app = buildApp();
    const token = makeToken({ id: 1, role: 'SuperAdmin' });
    const res = await request(app)
      .get('/api/analytics/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.loginsByDay).toHaveLength(14);
    const todayEntry = res.body.loginsByDay.find((d: { date: string }) => d.date === todayKey);
    expect(todayEntry?.count).toBe(2);
    expect(res.body.roleDistribution).toEqual([
      { role: 'SuperAdmin', count: 1 },
      { role: 'Manager', count: 2 },
      { role: 'Employee', count: 7 },
    ]);
  });
});
