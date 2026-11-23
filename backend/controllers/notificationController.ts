import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { createNotification } from '../utils/notificationUtils';

import prisma from '../prismaClient';

// @desc    Get notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const { isRead, type, startDate, endDate, page = '1', limit = '10' } = req.query;
    const userId = req.user!.id;

    let whereClause: any = { userId, deletedAt: null };

    if (isRead !== undefined) {
      whereClause.isRead = isRead === 'true';
    }

    if (type) {
      whereClause.type = String(type);
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

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNumber
      }),
      prisma.notification.count({ where: whereClause })
    ]);

    res.json({
      notifications,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber)
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false, deletedAt: null }
    });
    res.json({ count });
  } catch (error) {
    console.error('Get Unread Count Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = Number(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });

    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    if (notification.userId !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Mark Read Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark all as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark All Read Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = Number(req.params.id);
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });

    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    if (notification.userId !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        deletedAt: new Date(),
        deletedById: req.user!.id
      }
    });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete Notification Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Check task deadlines and generate notifications
// @route   POST /api/notifications/check-deadlines
// @access  Private/SuperAdmin, Manager
export const checkDeadlines = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Approaching deadlines
    const approachingTasks = await prisma.task.findMany({
      where: {
        deadline: { gt: now, lte: next24h },
        status: { notIn: ['Approved', 'Completed'] },
        assignedToId: { not: null }
      }
    });

    for (const task of approachingTasks) {
      // Check if we already notified for approaching within the last 24h
      const existing = await prisma.notification.findFirst({
        where: {
          userId: task.assignedToId!,
          entityId: task.id,
          type: 'deadline_reminder',
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      });
      if (!existing) {
        await createNotification({
          userId: task.assignedToId!,
          title: 'Deadline Approaching',
          message: `Task deadline is approaching: ${task.title}`,
          type: 'deadline_reminder',
          entityType: 'Task',
          entityId: task.id
        });
      }
    }

    // 2. Overdue tasks
    const overdueTasks = await prisma.task.findMany({
      where: {
        deadline: { lt: now },
        status: { notIn: ['Approved', 'Completed'] },
        assignedToId: { not: null }
      }
    });

    for (const task of overdueTasks) {
      // Check if we already notified for overdue within the last 24h
      const existing = await prisma.notification.findFirst({
        where: {
          userId: task.assignedToId!,
          entityId: task.id,
          type: 'task_overdue',
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      });
      if (!existing) {
        await createNotification({
          userId: task.assignedToId!,
          title: 'Task Overdue',
          message: `Task is overdue: ${task.title}`,
          type: 'task_overdue',
          entityType: 'Task',
          entityId: task.id
        });
      }
    }

    res.json({ message: 'Deadlines checked successfully' });
  } catch (error) {
    console.error('Check Deadlines Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
