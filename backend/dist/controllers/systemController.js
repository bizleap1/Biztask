"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flushOldData = exports.clearAllData = void 0;
const prismaClient_1 = __importDefault(require("../prismaClient"));
const clearAllData = async (req, res) => {
    try {
        // We must respect foreign key constraints. 
        // Delete in this order:
        // 1. Comments, ActivityLogs, Notifications (Depend on Tasks/Users)
        // 2. TaskSubmissions (Depend on Tasks)
        // 3. DailyReports (Depend on Users/Departments)
        // 4. Tasks (Depend on Users/Departments)
        await prismaClient_1.default.$transaction([
            prismaClient_1.default.comment.deleteMany(),
            prismaClient_1.default.activityLog.deleteMany(),
            prismaClient_1.default.notification.deleteMany(),
            prismaClient_1.default.taskSubmission.deleteMany(),
            prismaClient_1.default.dailyReport.deleteMany(),
            prismaClient_1.default.task.deleteMany()
        ]);
        // Optional: Log this massive action
        // @ts-ignore
        if (req.user && req.user.id) {
            await prismaClient_1.default.activityLog.create({
                data: {
                    // @ts-ignore
                    userId: req.user.id,
                    action: 'SYSTEM_DATA_CLEARED',
                    description: 'SuperAdmin cleared all tasks, reports, and related data.',
                    ipAddress: req.ip || null,
                }
            });
        }
        res.status(200).json({ message: 'All system data (tasks, reports, submissions, etc.) cleared successfully.' });
    }
    catch (error) {
        console.error('Error clearing system data:', error);
        res.status(500).json({ message: 'Failed to clear system data', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
exports.clearAllData = clearAllData;
const flushOldData = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const [deletedLogs, deletedNotifications] = await prismaClient_1.default.$transaction([
            prismaClient_1.default.activityLog.deleteMany({
                where: { createdAt: { lt: thirtyDaysAgo } }
            }),
            prismaClient_1.default.notification.deleteMany({
                where: { createdAt: { lt: thirtyDaysAgo }, isRead: true }
            })
        ]);
        // Log the flush action
        // @ts-ignore
        if (req.user && req.user.id) {
            await prismaClient_1.default.activityLog.create({
                data: {
                    // @ts-ignore
                    userId: req.user.id,
                    action: 'SYSTEM_DATA_FLUSHED',
                    description: `SuperAdmin flushed ${deletedLogs.count} old activity logs and ${deletedNotifications.count} read notifications.`,
                    ipAddress: req.ip || null,
                }
            });
        }
        res.status(200).json({
            message: 'Old system data flushed successfully.',
            details: {
                logsDeleted: deletedLogs.count,
                notificationsDeleted: deletedNotifications.count
            }
        });
    }
    catch (error) {
        console.error('Error flushing old data:', error);
        res.status(500).json({ message: 'Failed to flush old data', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
exports.flushOldData = flushOldData;
