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
  getPortalOverview: (_req: any, res: any) => res.json({ clients: [] }),
  getPortalTasks: (_req: any, res: any) => res.json([]),
  getPortalTaskById: (_req: any, res: any) => res.json({ id: 1 }),
  approvePortalTask: (req: any, res: any) => res.json({ id: 1, clientApprovalStatus: req.body.status }),
  getPortalInvoices: (_req: any, res: any) => res.json([]),
  getPortalReports: (_req: any, res: any) => res.json([]),
  getPortalRequests: (_req: any, res: any) => res.json([]),
  createPortalRequest: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  convertPortalRequest: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  getIntegrationStatus: (_req: any, res: any) => res.json({ accounts: [], recentSyncs: [] }),
  previewPortalAsClient: (_req: any, res: any) => res.json({ id: 1 })
}));

import portalRoutes from '../routes/portalRoutes';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/portal', portalRoutes);
  return app;
};

describe('Sprint 14/15 portal workflows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated portal access', async () => {
    const res = await request(buildApp()).get('/api/portal/overview');
    expect(res.status).toBe(401);
  });

  it('allows ClientUser task approval', async () => {
    const res = await request(buildApp()).post('/api/portal/tasks/1/approval')
      .set('x-test-role', 'ClientUser')
      .send({ status: 'Approved' });
    expect(res.status).toBe(200);
  });

  it('rejects Employee from portal preview', async () => {
    const res = await request(buildApp()).get('/api/portal/preview/1')
      .set('x-test-role', 'Employee');
    expect(res.status).toBe(403);
  });

  it('allows Manager to preview client portal', async () => {
    const res = await request(buildApp()).get('/api/portal/preview/1')
      .set('x-test-role', 'Manager');
    expect(res.status).toBe(200);
  });
});
