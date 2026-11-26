import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/authMiddleware', () => ({
  protect: (req: any, res: any, next: any) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ message: 'Not authorized' });
    req.user = { id: 1, role, departmentId: 7, isActive: true };
    next();
  },
  AuthRequest: {}
}));

vi.mock('../controllers/meetingController', () => ({
  getMeetings: (_req: any, res: any) => res.json([]),
  getMeetingById: (_req: any, res: any) => res.json({ id: 1 }),
  createMeeting: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  updateMeeting: (_req: any, res: any) => res.json({ id: 1 }),
  saveMeetingMinutes: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  createMeetingActionItem: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  convertMeetingActionItemToTask: (_req: any, res: any) => res.status(201).json({ id: 1 })
}));

import meetingRoutes from '../routes/meetingRoutes';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/meetings', meetingRoutes);
  return app;
};

describe('Sprint 6 meeting authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated meeting access', async () => {
    const res = await request(buildApp()).get('/api/meetings');
    expect(res.status).toBe(401);
  });

  it('allows Manager to create a meeting', async () => {
    const res = await request(buildApp()).post('/api/meetings')
      .set('x-test-role', 'Manager')
      .send({ title: 'Sprint Review', startAt: '2026-12-01T10:00:00Z' });
    expect(res.status).toBe(201);
  });

  it('rejects Employee from creating a meeting', async () => {
    const res = await request(buildApp()).post('/api/meetings')
      .set('x-test-role', 'Employee')
      .send({ title: 'Sprint Review', startAt: '2026-12-01T10:00:00Z' });
    expect(res.status).toBe(403);
  });
});
