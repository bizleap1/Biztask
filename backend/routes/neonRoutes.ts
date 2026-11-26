import { Router, Request, Response } from 'express';
import prisma from '../prismaClient';
import { isRealtimeConfigured, getRealtimeConfig, realtime } from '../utils/neonRealtime';
import { rawSql } from '@neon/realtime/server';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = Router();

// @desc    Check Neon Postgres and Realtime integration health
// @route   GET /api/neon/health
// @access  Public
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const start = Date.now();
    // Test Postgres query through Prisma
    const [dbResult] = await prisma.$queryRaw<Array<{ version: string; current_database: string }>>`
      SELECT version(), current_database()
    `;
    const latency = Date.now() - start;

    const realtimeConfig = getRealtimeConfig();

    res.json({
      status: 'ok',
      neon: {
        postgres: {
          connected: true,
          database: dbResult.current_database,
          version: dbResult.version,
          latencyMs: latency,
          pooler: process.env.DATABASE_URL?.includes('-pooler') ?? false
        },
        realtime: {
          configured: realtimeConfig.configured,
          url: realtimeConfig.url,
          branch: realtimeConfig.branch,
          branchId: realtimeConfig.branchId
        }
      }
    });
  } catch (error: any) {
    console.error('Neon health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Neon services health check failed'
    });
  }
});

// @desc    Seal a live query for tasks using Neon Realtime
// @route   POST /api/neon/realtime/seal-tasks
// @access  Public
router.post('/realtime/seal-tasks', protect, authorizeRoles('SuperAdmin', 'Manager'), async (_req: Request, res: Response) => {
  try {
    if (!realtime) {
      return res.status(503).json({ message: 'Neon Realtime is not configured' });
    }

    const query = rawSql(
      'SELECT id, "updatedAt" FROM "Task" WHERE "isDeleted" = false ORDER BY id'
    );

    const sealed = await realtime.seal({ query });
    res.json({ status: 'ok', sealed });
  } catch (error: any) {
    console.error('Neon Realtime seal error:', error);
    res.status(500).json({ message: error.message || 'Failed to seal query' });
  }
});

export default router;
