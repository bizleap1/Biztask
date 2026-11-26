import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ message: 'Not authorized' });
    req.user = { id: 1, role, isActive: true };
    next();
  },
  AuthRequest: {}
}));

vi.mock('../controllers/crmController', () => ({
  getLeads: (_req: any, res: any) => res.json([]),
  getLeadById: (_req: any, res: any) => res.json({ id: 1 }),
  createLead: (_req: any, res: any) => res.status(201).json({ id: 1, stage: 'New' }),
  updateLead: (req: any, res: any) => res.json({ id: 1, stage: req.body?.stage }),
  addLeadActivity: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  convertLead: (_req: any, res: any) => res.status(201).json({ client: { id: 10 }, deal: { id: 20 } })
}));

import crmRoutes from '../routes/crmRoutes';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/crm', crmRoutes);
  return app;
};

describe('Sprint 9 CRM authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated CRM access', async () => {
    const res = await request(buildApp()).get('/api/crm/leads');
    expect(res.status).toBe(401);
  });

  it('allows Manager to create a lead', async () => {
    const res = await request(buildApp()).post('/api/crm/leads')
      .set('x-test-role', 'Manager')
      .send({ name: 'Acme Lead', dealValue: 50000 });
    expect(res.status).toBe(201);
  });

  it('rejects Employee from converting a lead', async () => {
    const res = await request(buildApp()).post('/api/crm/leads/1/convert')
      .set('x-test-role', 'Employee');
    expect(res.status).toBe(403);
  });

  it('allows TeamLead to convert a Won lead', async () => {
    const res = await request(buildApp()).post('/api/crm/leads/1/convert')
      .set('x-test-role', 'TeamLead');
    expect(res.status).toBe(201);
  });
});
