"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDeadlines = exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getUnreadCount = exports.getNotifications = void 0;
const notificationUtils_1 = require("../utils/notificationUtils");
const prismaClient_1 = __importDefault(require("../prismaClient"));
// @desc    Get notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const { isRead, type, startDate, endDate, page = '1', limit = '10' } = req.query;
        const userId = req.user.id;
        let whereClause = { userId };
        if (isRead !== undefined) {
            whereClause.isRead = isRead === 'true';
        }
        if (type) {
            whereClause.type = String(type);
        }
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate)
                whereClause.createdAt.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt.lte = end;
            }
        }
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;
        const [notifications, total] = await Promise.all([
            prismaClient_1.default.notification.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNumber
            }),
            prismaClient_1.default.notification.count({ where: whereClause })
        ]);
        res.json({
            notifications,
            total,
            page: pageNumber,
            pages: Math.ceil(total / limitNumber)
        });
    }
    catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getNotifications = getNotifications;
// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
    try {
        const count = await prismaClient_1.default.notification.count({
            where: { userId: req.user.id, isRead: false }
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Get Unread Count Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getUnreadCount = getUnreadCount;
// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        const notification = await prismaClient_1.default.notification.findUnique({ where: { id: notificationId } });
        if (!notification)
            return res.status(404).json({ message: 'Notification not found' });
        if (notification.userId !== req.user.id)
            return res.status(403).json({ message: 'Forbidden' });
        const updated = await prismaClient_1.default.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markAsRead = markAsRead;
// @desc    Mark all as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
    try {
        await prismaClient_1.default.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true }
        });
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        console.error('Mark All Read Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markAllAsRead = markAllAsRead;
// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        const notification = await prismaClient_1.default.notification.findUnique({ where: { id: notificationId } });
        if (!notification)
            return res.status(404).json({ message: 'Notification not found' });
        if (notification.userId !== req.user.id)
            return res.status(403).json({ message: 'Forbidden' });
        await prismaClient_1.default.notification.delete({ where: { id: notificationId } });
        res.json({ message: 'Notification deleted' });
    }
    catch (error) {
        console.error('Delete Notification Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteNotification = deleteNotification;
// @desc    Check task deadlines and generate notifications
// @route   POST /api/notifications/check-deadlines
// @access  Private/SuperAdmin, Manager
const checkDeadlines = async (req, res) => {
    try {
        const now = new Date();
        const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        // 1. Approaching deadlines
        const approachingTasks = await prismaClient_1.default.task.findMany({
            where: {
                isDeleted: false,
                deadline: { gt: now, lte: next24h },
                status: { notIn: ['Approved', 'Completed'] },
                assignedToId: { not: null },
                assignedTo: { isActive: true }
            }
        });
        for (const task of approachingTasks) {
            // Check if we already notified for approaching within the last 24h
            const existing = await prismaClient_1.default.notification.findFirst({
                where: {
                    userId: task.assignedToId,
                    entityId: task.id,
                    type: 'deadline_reminder',
                    createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
                }
            });
            if (!existing) {
                await (0, notificationUtils_1.createNotification)({
                    userId: task.assignedToId,
                    title: 'Deadline Approaching',
                    message: `Task deadline is approaching: ${task.title}`,
                    type: 'deadline_reminder',
                    entityType: 'Task',
                    entityId: task.id
                });
            }
        }
        // 2. Overdue tasks
        const overdueTasks = await prismaClient_1.default.task.findMany({
            where: {
                isDeleted: false,
                deadline: { lt: now },
                status: { notIn: ['Approved', 'Completed'] },
                assignedToId: { not: null },
                assignedTo: { isActive: true }
            }
        });
        for (const task of overdueTasks) {
            // Check if we already notified for overdue within the last 24h
            const existing = await prismaClient_1.default.notification.findFirst({
                where: {
                    userId: task.assignedToId,
                    entityId: task.id,
                    type: 'task_overdue',
                    createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
                }
            });
            if (!existing) {
                await (0, notificationUtils_1.createNotification)({
                    userId: task.assignedToId,
                    title: 'Task Overdue',
                    message: `Task is overdue: ${task.title}`,
                    type: 'task_overdue',
                    entityType: 'Task',
                    entityId: task.id
                });
            }
        }
        res.json({ message: 'Deadlines checked successfully' });
    }
    catch (error) {
        console.error('Check Deadlines Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.checkDeadlines = checkDeadlines;
