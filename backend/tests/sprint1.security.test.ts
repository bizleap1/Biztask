import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock Prisma client before importing app using vi.hoisted
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  task: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  taskSubmission: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  dailyReport: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  notification: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
  department: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (cb: any): Promise<any> => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
}));

vi.mock('../prismaClient', () => ({
  default: mockPrisma,
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
}));

process.env.JWT_SECRET = 'test_super_secret_key_for_vitest_suite_32chars';

import app from '../index';

const signToken = (id: number) =>
  jwt.sign({ id }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '1h' });

describe('Sprint 1 Security & Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth & Middleware Hardening', () => {
    it('rejects unauthenticated requests to protected routes', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(401);
    });

    it('rejects malformed Bearer header without space', async () => {
      const token = signToken(1);
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer${token}`);
      expect(res.status).toBe(401);
    });

    it('blocks API access when mustChangePassword is true (except change-password/logout)', async () => {
      const token = signToken(2);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Temp User',
        email: 'temp@bizleap.com',
        role: 'DevEmployee',
        departmentId: 2,
        isActive: true,
        mustChangePassword: true,
      });

      const res = await request(app)
        .get('/api/tasks/my')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.mustChangePassword).toBe(true);
    });

    it('returns 400 on invalid login payload', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: '' });
      expect(res.status).toBe(400);
    });

    it('does not leak user existence on requestPasswordReset', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: 'nonexistent@bizleap.com' });
      expect(res.status).toBe(200);
    });
  });

  describe('Privilege Escalation & RBAC Prevention', () => {
    it('prevents Manager from changing user roles via PUT /api/users/:id', async () => {
      const managerToken = signToken(10);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 10,
          name: 'Manager',
          email: 'mgr@bizleap.com',
          role: 'Manager',
          departmentId: 1,
          isActive: true,
          mustChangePassword: false,
        })
        .mockResolvedValueOnce({
          id: 20,
          name: 'Emp',
          email: 'emp@bizleap.com',
          role: 'DevEmployee',
          departmentId: 2,
          isActive: true,
        });

      const res = await request(app)
        .put('/api/users/20')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ role: 'Manager' });

      expect(res.status).toBe(403);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('prevents Manager from toggling isActive via PUT /api/users/:id', async () => {
      const managerToken = signToken(10);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 10,
          name: 'Manager',
          email: 'mgr@bizleap.com',
          role: 'Manager',
          departmentId: 1,
          isActive: true,
          mustChangePassword: false,
        })
        .mockResolvedValueOnce({
          id: 20,
          name: 'Emp',
          email: 'emp@bizleap.com',
          role: 'DevEmployee',
          departmentId: 2,
          isActive: true,
        });

      const res = await request(app)
        .put('/api/users/20')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('prevents employees from approving their own tasks via PUT /api/tasks/:id', async () => {
      const empToken = signToken(20);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 20,
        name: 'Emp',
        email: 'emp@bizleap.com',
        role: 'DevEmployee',
        departmentId: 2,
        isActive: true,
        mustChangePassword: false,
      });
      mockPrisma.task.findFirst.mockResolvedValueOnce({
        id: 100,
        title: 'Test Task',
        status: 'Pending',
        assignedById: 20,
        assignedToId: 20,
        departmentId: 2,
        isDeleted: false,
      });

      const res = await request(app)
        .put('/api/tasks/100')
        .set('Authorization', `Bearer ${empToken}`)
        .send({ status: 'Approved' });

      expect(res.status).toBe(403);
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('Mass Deletion & Audit Log Immutability', () => {
    const adminUser = {
      id: 1,
      name: 'SuperAdmin',
      email: 'admin@bizleap.com',
      role: 'SuperAdmin',
      departmentId: 1,
      isActive: true,
      mustChangePassword: false,
    };

    it('rejects DELETE /api/tasks/bulk when ids array is empty', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser);
      const res = await request(app)
        .delete('/api/tasks/bulk')
        .set('Authorization', `Bearer ${signToken(1)}`)
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('rejects DELETE /api/submissions/bulk when ids is omitted', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser);
      const res = await request(app)
        .delete('/api/submissions/bulk')
        .set('Authorization', `Bearer ${signToken(1)}`)
        .send({});

      expect(res.status).toBe(400);
      expect(mockPrisma.taskSubmission.updateMany).not.toHaveBeenCalled();
    });

    it('rejects DELETE /api/daily-reports/bulk when ids is empty', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser);
      const res = await request(app)
        .delete('/api/daily-reports/bulk')
        .set('Authorization', `Bearer ${signToken(1)}`)
        .send({ ids: [] });

      expect(res.status).toBe(400);
      expect(mockPrisma.dailyReport.updateMany).not.toHaveBeenCalled();
    });

    it('disables activity log deletion endpoints (404)', async () => {
      const resSingle = await request(app)
        .delete('/api/activity-logs/1')
        .set('Authorization', `Bearer ${signToken(1)}`);
      const resBulk = await request(app)
        .delete('/api/activity-logs/bulk')
        .set('Authorization', `Bearer ${signToken(1)}`)
        .send({ ids: [1] });

      expect(resSingle.status).toBe(404);
      expect(resBulk.status).toBe(404);
    });
  });

  describe('Submission & Dashboard Integrity', () => {
    it('handles omitted completionPercentage in submitTask without NaN crash', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 20,
        name: 'Emp',
        email: 'emp@bizleap.com',
        role: 'DevEmployee',
        departmentId: 2,
        isActive: true,
        mustChangePassword: false,
      });
      mockPrisma.task.findFirst.mockResolvedValueOnce({
        id: 100,
        title: 'Task',
        status: 'In Progress',
        assignedToId: 20,
        assignedById: 1,
        proofRequired: false,
        isDeleted: false,
      });
      (mockPrisma.taskSubmission as any).create = vi.fn().mockResolvedValueOnce({
        id: 500,
        taskId: 100,
        completionPercentage: 100,
      });
      mockPrisma.task.update.mockResolvedValueOnce({ id: 100, status: 'Submitted' });

      const res = await request(app)
        .post('/api/tasks/100/submit')
        .set('Authorization', `Bearer ${signToken(20)}`)
        .send({ reportText: 'Work done' });

      expect(res.status).toBe(201);
      expect((mockPrisma.taskSubmission as any).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completionPercentage: 100 }),
        })
      );
    });
  });
});
