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
    let whereClause: any = { isDeleted: false };

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
      where: { userId: req.user!.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to recent 50
    });
    res.json(logs);
  } catch (error) {
    console.error('Get My Activity Logs Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete activity log
// @route   DELETE /api/activity-logs/:id
// @access  Private
export const deleteActivityLog = async (req: AuthRequest, res: Response) => {
  try {
    const log = await prisma.activityLog.findUnique({ where: { id: Number(req.params.id) } });
    if (!log) return res.status(404).json({ message: 'Log not found' });
    if (req.user!.role !== 'SuperAdmin' && req.user!.role !== 'Manager' && log.userId !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await prisma.activityLog.update({ where: { id: Number(req.params.id) }, data: { isDeleted: true } });
    res.json({ message: 'Activity log deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Bulk delete activity logs
// @route   DELETE /api/activity-logs/bulk
// @access  Private
export const bulkDeleteActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    let whereClause: any = {};
    if (ids && Array.isArray(ids) && ids.length > 0) {
      whereClause.id = { in: ids };
    }
    if (req.user!.role !== 'SuperAdmin' && req.user!.role !== 'Manager') {
      whereClause.userId = req.user!.id;
    }
    const deleted = await prisma.activityLog.updateMany({ where: whereClause, data: { isDeleted: true } });
    res.json({ message: `${deleted.count} logs deleted successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
