/**
 * Sprint 2 — RBAC & Teams Tests
 * Tests RBAC utility functions, team routes, and role normalization.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  CANONICAL_ROLES,
  LEGACY_ROLES,
  normalizeRole,
  roleMatches,
  canGrantRole,
  isStaffRole,
} from '../utils/rbac';

const JWT_SECRET = 'test-secret-key-min-32-chars-long!!';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  team: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  teamMembership: {
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
  $transaction: vi.fn(async (cb: any): Promise<any> => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
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

import teamRoutes from '../routes/teamRoutes';

function makeToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/teams', teamRoutes);
  return app;
};

describe('RBAC — role definitions', () => {
  it('CANONICAL_ROLES contains expected roles', () => {
    expect(CANONICAL_ROLES).toContain('SuperAdmin');
    expect(CANONICAL_ROLES).toContain('Manager');
    expect(CANONICAL_ROLES).toContain('TeamLead');
    expect(CANONICAL_ROLES).toContain('Employee');
    expect(CANONICAL_ROLES).toContain('ClientUser');
  });

  it('LEGACY_ROLES contains legacy roles', () => {
    expect(LEGACY_ROLES).toContain('DevEmployee');
    expect(LEGACY_ROLES).toContain('MediaEmployee');
    expect(LEGACY_ROLES).toContain('Viewer');
  });
});

describe('normalizeRole()', () => {
  it('normalizes DevEmployee -> Employee', () => {
    expect(normalizeRole('DevEmployee')).toBe('Employee');
  });

  it('normalizes MediaEmployee -> Employee', () => {
    expect(normalizeRole('MediaEmployee')).toBe('Employee');
  });

  it('passes through canonical roles unchanged', () => {
    expect(normalizeRole('SuperAdmin')).toBe('SuperAdmin');
    expect(normalizeRole('Manager')).toBe('Manager');
    expect(normalizeRole('TeamLead')).toBe('TeamLead');
    expect(normalizeRole('Employee')).toBe('Employee');
    expect(normalizeRole('ClientUser')).toBe('ClientUser');
  });

  it('returns the role as-is for unknown roles', () => {
    expect(normalizeRole('UnknownRole')).toBe('UnknownRole');
  });
});

describe('roleMatches()', () => {
  it('returns true when userRole is in allowedRoles', () => {
    expect(roleMatches('Manager', ['Manager'])).toBe(true);
  });

  it('returns true when legacy role normalizes to match allowedRoles', () => {
    expect(roleMatches('DevEmployee', ['Employee'])).toBe(true);
    expect(roleMatches('MediaEmployee', ['Employee'])).toBe(true);
  });

  it('returns false when roles do not match', () => {
    expect(roleMatches('Employee', ['Manager'])).toBe(false);
    expect(roleMatches('DevEmployee', ['Manager'])).toBe(false);
  });

  it('SuperAdmin does not match Employee via normalization', () => {
    expect(roleMatches('SuperAdmin', ['Employee'])).toBe(false);
  });
});

describe('canGrantRole()', () => {
  it('SuperAdmin can grant any valid role', () => {
    expect(canGrantRole('SuperAdmin', 'SuperAdmin')).toBe(true);
    expect(canGrantRole('SuperAdmin', 'Manager')).toBe(true);
    expect(canGrantRole('SuperAdmin', 'TeamLead')).toBe(true);
    expect(canGrantRole('SuperAdmin', 'Employee')).toBe(true);
    expect(canGrantRole('SuperAdmin', 'ClientUser')).toBe(true);
  });

  it('Manager can grant Employee and TeamLead, but not SuperAdmin, Manager, or ClientUser', () => {
    expect(canGrantRole('Manager', 'Employee')).toBe(true);
    expect(canGrantRole('Manager', 'TeamLead')).toBe(true);
    expect(canGrantRole('Manager', 'ClientUser')).toBe(false);
    expect(canGrantRole('Manager', 'SuperAdmin')).toBe(false);
    expect(canGrantRole('Manager', 'Manager')).toBe(false);
  });

  it('Employee cannot grant any role', () => {
    expect(canGrantRole('Employee', 'Employee')).toBe(false);
    expect(canGrantRole('Employee', 'TeamLead')).toBe(false);
  });

  it('Legacy DevEmployee behaves like Employee (cannot grant)', () => {
    expect(canGrantRole('DevEmployee', 'Employee')).toBe(false);
  });
});

describe('isStaffRole()', () => {
  it('returns true for staff/internal roles', () => {
    expect(isStaffRole('Employee')).toBe(true);
    expect(isStaffRole('TeamLead')).toBe(true);
    expect(isStaffRole('DevEmployee')).toBe(true);
    expect(isStaffRole('MediaEmployee')).toBe(true);
    expect(isStaffRole('SuperAdmin')).toBe(true);
    expect(isStaffRole('Manager')).toBe(true);
  });

  it('returns false for ClientUser', () => {
    expect(isStaffRole('ClientUser')).toBe(false);
  });
});

describe('GET /api/teams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without token', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(401);
  });

  it('returns 200 for authenticated Manager', async () => {
    mockPrisma.team.findMany.mockResolvedValueOnce([
      { id: 1, name: 'Dev Team', department: { id: 1, name: 'Engineering' }, lead: null, members: [] },
    ]);
    const token = makeToken({ id: 1, role: 'Manager', tv: 0 });
    const app = buildApp();
    const res = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 200 for authenticated legacy DevEmployee (normalized to Employee)', async () => {
    mockPrisma.team.findMany.mockResolvedValueOnce([]);
    const token = makeToken({ id: 2, role: 'DevEmployee', tv: 0 });
    const app = buildApp();
    const res = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/teams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without token', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/teams').send({ name: 'New Team', departmentId: 1 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for Employee trying to create team', async () => {
    const token = makeToken({ id: 2, role: 'Employee', tv: 0 });
    const app = buildApp();
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Team', departmentId: 1 });
    expect(res.status).toBe(403);
  });

  it('returns 201 when Manager creates a team', async () => {
    mockPrisma.team.findUnique.mockResolvedValueOnce(null);
    mockPrisma.team.create.mockResolvedValueOnce({
      id: 2, name: 'New Team', departmentId: 1, leadId: null,
    });
    const token = makeToken({ id: 1, role: 'Manager', tv: 0 });
    const app = buildApp();
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Team', departmentId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Team');
  });
});

describe('POST /api/teams/:id/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for Employee trying to add member', async () => {
    const token = makeToken({ id: 2, role: 'Employee', tv: 0 });
    const app = buildApp();
    const res = await request(app)
      .post('/api/teams/1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: 3, role: 'Member' });
    expect(res.status).toBe(403);
  });

  it('returns 201 when SuperAdmin adds a valid member', async () => {
    mockPrisma.team.findUnique.mockResolvedValueOnce({ id: 1, name: 'Dev Team' });
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 3, isActive: true });
    mockPrisma.teamMembership.upsert.mockResolvedValueOnce({ id: 5, teamId: 1, userId: 3, role: 'Member' });
    const token = makeToken({ id: 1, role: 'SuperAdmin', tv: 0 });
    const app = buildApp();
    const res = await request(app)
      .post('/api/teams/1/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: 3, role: 'Member' });
    expect(res.status).toBe(201);
  });
});

describe('DELETE /api/teams/:id/members/:userId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when SuperAdmin removes a member', async () => {
    mockPrisma.teamMembership.delete.mockResolvedValueOnce({ id: 5 });
    mockPrisma.team.updateMany.mockResolvedValueOnce({ count: 0 });
    const token = makeToken({ id: 1, role: 'SuperAdmin', tv: 0 });
    const app = buildApp();
    const res = await request(app)
      .delete('/api/teams/1/members/3')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
