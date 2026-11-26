import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ message: 'Not authorized' });
    req.user = { id: 99, role, isActive: true };
    next();
  },
  AuthRequest: {}
}));

vi.mock('../controllers/portalController', () => ({
  getPortalOverview: (_req: any, res: any) => res.json({ clients: [{ id: 1 }] }),
  getPortalTasks: (_req: any, res: any) => res.json([]),
  getPortalTaskById: (_req: any, res: any) => res.json({ id: 1, clientVisible: true })
}));

import portalRoutes from '../routes/portalRoutes';

const buildApp = () => {
  const app = express();
  app.use('/api/portal', portalRoutes);
  return app;
};

describe('Sprint 13 client portal authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated portal access', async () => {
    const res = await request(buildApp()).get('/api/portal/overview');
    expect(res.status).toBe(401);
  });

  it('allows ClientUser to access portal overview', async () => {
    const res = await request(buildApp()).get('/api/portal/overview').set('x-test-role', 'ClientUser');
    expect(res.status).toBe(200);
  });

  it('rejects Employee from client portal', async () => {
    const res = await request(buildApp()).get('/api/portal/tasks').set('x-test-role', 'Employee');
    expect(res.status).toBe(403);
  });
});
