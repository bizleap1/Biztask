"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyActivityLogs = exports.getActivityLogs = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// @desc    Get activity logs (Admin/Manager)
// @route   GET /api/activity-logs
// @access  Private/SuperAdmin, Manager
const getActivityLogs = async (req, res) => {
    try {
        const { userId, action, entityType, startDate, endDate, search, page = '1', limit = '20' } = req.query;
        const { role } = req.user;
        // Employees shouldn't access this route, it's guarded by roleMiddleware
        let whereClause = {};
        if (userId)
            whereClause.userId = Number(userId);
        if (action)
            whereClause.action = String(action);
        if (entityType)
            whereClause.entityType = String(entityType);
        if (search) {
            whereClause.description = { contains: String(search) };
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
    }
    catch (error) {
        console.error('Get Activity Logs Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getActivityLogs = getActivityLogs;
// @desc    Get my activity logs
// @route   GET /api/activity-logs/my
// @access  Private
const getMyActivityLogs = async (req, res) => {
    try {
        const logs = await prisma.activityLog.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to recent 50
        });
        res.json(logs);
    }
    catch (error) {
        console.error('Get My Activity Logs Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMyActivityLogs = getMyActivityLogs;
