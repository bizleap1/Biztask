import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../prismaClient';
import { createActivityLog } from '../utils/activityLogUtils';

// @desc    Get all soft-deleted items across tasks, reports, and users
// @route   GET /api/trash
// @access  Private/SuperAdmin
export const getTrash = async (req: AuthRequest, res: Response) => {
  try {
    const [tasks, reports, users] = await Promise.all([
      prisma.task.findMany({
        where: { deletedAt: { not: null } },
        include: {
          assignedTo: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } }
        },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.dailyReport.findMany({
        where: { deletedAt: { not: null } },
        include: {
          user: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } }
        },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.user.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          deletedAt: true,
          deletedById: true
        },
        orderBy: { deletedAt: 'desc' }
      })
    ]);

    const items = [
      ...tasks.map(t => ({
        id: t.id,
        type: 'task' as const,
        title: t.title,
        detail: `Assigned to: ${t.assignedTo?.name || 'Unassigned'}`,
        deletedAt: t.deletedAt,
        deletedById: t.deletedById
      })),
      ...reports.map(r => ({
        id: r.id,
        type: 'report' as const,
        title: `Report #${r.id} (${new Date(r.reportDate).toLocaleDateString()})`,
        detail: `Submitted by: ${r.user?.name || 'Unknown'}`,
        deletedAt: r.deletedAt,
        deletedById: r.deletedById
      })),
      ...users.map(u => ({
        id: u.id,
        type: 'user' as const,
        title: `${u.name} (${u.email})`,
        detail: `Role: ${u.role}`,
        deletedAt: u.deletedAt,
        deletedById: u.deletedById
      }))
    ].sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

    res.json({ items });
  } catch (error) {
    console.error('Get Trash Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Restore a soft-deleted item
// @route   POST /api/trash/restore
// @access  Private/SuperAdmin
export const restoreItem = async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.body;
    if (!type || !id) {
      return res.status(400).json({ message: 'Type and ID are required' });
    }

    const numericId = Number(id);

    if (type === 'task') {
      const task = await prisma.task.findUnique({ where: { id: numericId } });
      if (!task) return res.status(404).json({ message: 'Task not found' });

      await prisma.task.update({
        where: { id: numericId },
        data: {
          deletedAt: null,
          isDeleted: false,
          deletedById: null
        }
      });

      await createActivityLog({
        userId: req.user!.id,
        action: 'RESTORE_TASK',
        entityType: 'Task',
        entityId: numericId,
        description: `${req.user!.name} restored task #${numericId}: "${task.title}"`,
        actorType: 'User',
        actorName: req.user!.name
      });

      return res.json({ message: 'Task restored successfully' });
    }

    if (type === 'report') {
      const report = await prisma.dailyReport.findUnique({ where: { id: numericId } });
      if (!report) return res.status(404).json({ message: 'Daily report not found' });

      await prisma.dailyReport.update({
        where: { id: numericId },
        data: {
          deletedAt: null,
          isDeleted: false,
          deletedById: null
        }
      });

      await createActivityLog({
        userId: req.user!.id,
        action: 'RESTORE_REPORT',
        entityType: 'DailyReport',
        entityId: numericId,
        description: `${req.user!.name} restored daily report #${numericId}`,
        actorType: 'User',
        actorName: req.user!.name
      });

      return res.json({ message: 'Daily report restored successfully' });
    }

    if (type === 'user') {
      const user = await prisma.user.findUnique({ where: { id: numericId } });
      if (!user) return res.status(404).json({ message: 'User not found' });

      await prisma.user.update({
        where: { id: numericId },
        data: {
          deletedAt: null,
          isActive: true,
          deletedById: null
        }
      });

      await createActivityLog({
        userId: req.user!.id,
        action: 'RESTORE_USER',
        entityType: 'User',
        entityId: numericId,
        description: `${req.user!.name} restored user account #${numericId}: ${user.name} (${user.email})`,
        actorType: 'User',
        actorName: req.user!.name
      });

      return res.json({ message: 'User restored successfully' });
    }

    return res.status(400).json({ message: 'Invalid item type' });
  } catch (error) {
    console.error('Restore Item Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
