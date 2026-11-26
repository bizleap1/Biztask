import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ message: 'Not authorized' });
    req.user = { id: 1, role, departmentId: 1, isActive: true };
    next();
  },
  AuthRequest: {}
}));

vi.mock('../controllers/financeController', () => ({
  getInvoices: (_req: any, res: any) => res.json([]),
  createInvoice: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  issueInvoice: (_req: any, res: any) => res.json({ id: 1, status: 'Issued' }),
  addReceipt: (_req: any, res: any) => res.status(201).json({ id: 1 })
}));
vi.mock('../controllers/attendanceController', () => ({
  checkIn: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  checkOut: (_req: any, res: any) => res.json({ id: 1 }),
  getAttendance: (_req: any, res: any) => res.json([]),
  importAttendance: (_req: any, res: any) => res.json({ imported: 1, skipped: 0 }),
  requestLeave: (_req: any, res: any) => res.status(201).json({ id: 1, status: 'Pending' }),
  getLeaveRequests: (_req: any, res: any) => res.json([]),
  decideLeave: (req: any, res: any) => res.json({ id: 1, status: req.body.status })
}));

import financeRoutes from '../routes/financeRoutes';
import attendanceRoutes from '../routes/attendanceRoutes';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/finance', financeRoutes);
  app.use('/api/attendance', attendanceRoutes);
  return app;
};

describe('Sprints 10-11 authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated attendance', async () => {
    const res = await request(buildApp()).post('/api/attendance/check-in');
    expect(res.status).toBe(401);
  });

  it('allows Employee to check in', async () => {
    const res = await request(buildApp()).post('/api/attendance/check-in').set('x-test-role', 'Employee');
    expect(res.status).toBe(201);
  });

  it('allows Manager to create invoices', async () => {
    const res = await request(buildApp()).post('/api/finance/invoices').set('x-test-role', 'Manager').send({});
    expect(res.status).toBe(201);
  });

  it('rejects Employee from creating invoices', async () => {
    const res = await request(buildApp()).post('/api/finance/invoices').set('x-test-role', 'Employee').send({});
    expect(res.status).toBe(403);
  });

  it('allows Manager to import attendance', async () => {
    const res = await request(buildApp()).post('/api/attendance/import').set('x-test-role', 'Manager').send({ records: [] });
    expect(res.status).toBe(200);
  });
});
