import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';

import prisma from '../prismaClient';

// @desc    Get activity logs (Admin/Manager)
// @route   GET /api/activity-logs
// @access  Private/SuperAdmin, Manager
export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, action, entityType, startDate, endDate, search, page = '1', limit = '20' } = req.query;
    const { role } = req.user!;

    // Employees shouldn't access this route, it's guarded by roleMiddleware
    let whereClause: any = { isDeleted: false, deletedAt: null };

    if (userId) whereClause.userId = Number(userId);
    if (action) whereClause.action = String(action);
    if (entityType) whereClause.entityType = String(entityType);
    
    if (search) {
      whereClause.description = { contains: String(search) };
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNumber
      }),
      prisma.activityLog.count({ where: whereClause })
    ]);

    res.json({
      logs,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber)
    });
  } catch (error) {
    console.error('Get Activity Logs Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get my activity logs
// @route   GET /api/activity-logs/my
// @access  Private
export const getMyActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.activityLog.findMany({
      where: { userId: req.user!.id, isDeleted: false, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to recent 50
    });
    res.json(logs);
  } catch (error) {
    console.error('Get My Activity Logs Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete activity log (Blocked - Append-only)
// @route   DELETE /api/activity-logs/:id
// @access  Private
export const deleteActivityLog = async (req: AuthRequest, res: Response) => {
  return res.status(403).json({
    error: {
      code: 'AUDIT_LOG_IMMUTABLE',
      message: 'Activity logs are append-only audit records and cannot be deleted.'
    }
  });
};

// @desc    Bulk delete activity logs (Blocked - Append-only)
// @route   DELETE /api/activity-logs/bulk
// @access  Private
export const bulkDeleteActivityLogs = async (req: AuthRequest, res: Response) => {
  return res.status(403).json({
    error: {
      code: 'AUDIT_LOG_IMMUTABLE',
      message: 'Activity logs are append-only audit records and cannot be deleted.'
    }
  });
};
