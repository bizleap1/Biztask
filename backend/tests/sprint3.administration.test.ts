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

vi.mock('../controllers/userController', () => ({
  getDepartments: (_req: any, res: any) => res.json([]),
  createDepartment: (_req: any, res: any) => res.status(201).json({ id: 1, name: 'Development' }),
  updateDepartment: (req: any, res: any) => res.json({ id: 1, name: req.body.name }),
  deleteDepartment: (_req: any, res: any) => res.json({ message: 'Department deleted successfully' }),
  getUsers: (_req: any, res: any) => res.json([]),
  getUserById: (_req: any, res: any) => res.json({ id: 1 }),
  createUser: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  updateUser: (_req: any, res: any) => res.json({ id: 1 }),
  deactivateUser: (_req: any, res: any) => res.json({ message: 'User deactivated successfully' }),
  activateUser: (_req: any, res: any) => res.json({ message: 'User activated successfully' }),
  deleteUser: (_req: any, res: any) => res.json({ message: 'Deleted' }),
  grantPasswordReset: (_req: any, res: any) => res.json({ resetCode: '1234' })
}));

vi.mock('../controllers/clientController', () => ({
  getClients: (_req: any, res: any) => res.json([]),
  getClientById: (_req: any, res: any) => res.json({ id: 1 }),
  createClient: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  updateClient: (_req: any, res: any) => res.json({ id: 1 }),
  deleteClient: (_req: any, res: any) => res.json({ message: 'Deleted' }),
  addClientContact: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  deleteClientContact: (_req: any, res: any) => res.json({ message: 'Deleted' }),
  getClientMemberships: (_req: any, res: any) => res.json([]),
  addClientMembership: (_req: any, res: any) => res.status(201).json({ id: 1 }),
  revokeClientMembership: (_req: any, res: any) => res.json({ message: 'Client membership revoked successfully' })
}));

import userRoutes from '../routes/userRoutes';
import clientRoutes from '../routes/clientRoutes';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  app.use('/api/clients', clientRoutes);
  return app;
};

describe('Sprint 3 administration authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated department creation', async () => {
    const res = await request(buildApp()).post('/api/users/departments').send({ name: 'Operations' });
    expect(res.status).toBe(401);
  });

  it('allows Manager to create a department', async () => {
    const res = await request(buildApp()).post('/api/users/departments')
      .set('x-test-role', 'Manager')
      .send({ name: 'Operations' });
    expect(res.status).toBe(201);
  });

  it('rejects Manager from deleting a department', async () => {
    const res = await request(buildApp()).delete('/api/users/departments/1')
      .set('x-test-role', 'Manager');
    expect(res.status).toBe(403);
  });

  it('allows Manager to grant client membership', async () => {
    const res = await request(buildApp()).post('/api/clients/1/memberships')
      .set('x-test-role', 'Manager')
      .send({ userId: 99, role: 'Member' });
    expect(res.status).toBe(201);
  });

  it('allows Manager to revoke client membership', async () => {
    const res = await request(buildApp()).delete('/api/clients/1/memberships/99')
      .set('x-test-role', 'Manager');
    expect(res.status).toBe(200);
  });
});
