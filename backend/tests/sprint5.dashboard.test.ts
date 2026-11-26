import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    req.user = req.headers['x-test-role']
      ? { id: 1, role: req.headers['x-test-role'], departmentId: 7, isActive: true }
      : undefined;
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });
    next();
  },
  AuthRequest: {}
}));

vi.mock('../controllers/dashboardController', () => ({
  getAdminDashboard: (_req: any, res: any) => res.json({ ok: true }),
  getManagerDashboard: (_req: any, res: any) => res.json({ ok: true }),
  getEmployeeDashboard: (_req: any, res: any) => res.json({ ok: true }),
  getHrDashboard: (_req: any, res: any) => res.json({ ok: true })
}));

import dashboardRoutes from '../routes/dashboardRoutes';

const buildApp = () => {
  const app = express();
  app.use('/api/dashboard', dashboardRoutes);
  return app;
};

describe('Sprint 5 dashboard authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows Manager to access manager dashboard', async () => {
    const res = await request(buildApp())
      .get('/api/dashboard/manager')
      .set('x-test-role', 'Manager');
    expect(res.status).toBe(200);
  });

  it('allows TeamLead to access manager dashboard', async () => {
    const res = await request(buildApp())
      .get('/api/dashboard/manager')
      .set('x-test-role', 'TeamLead');
    expect(res.status).toBe(200);
  });

  it('rejects Employee from manager dashboard', async () => {
    const res = await request(buildApp())
      .get('/api/dashboard/manager')
      .set('x-test-role', 'Employee');
    expect(res.status).toBe(403);
  });
});
