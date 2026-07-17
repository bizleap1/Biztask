"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteActivityLogs = exports.deleteActivityLog = exports.getMyActivityLogs = exports.getActivityLogs = void 0;
const prismaClient_1 = __importDefault(require("../prismaClient"));
// @desc    Get activity logs (Admin/Manager)
// @route   GET /api/activity-logs
// @access  Private/SuperAdmin, Manager
const getActivityLogs = async (req, res) => {
    try {
        const { userId, action, entityType, startDate, endDate, search, page = '1', limit = '20' } = req.query;
        const { role } = req.user;
        // Employees shouldn't access this route, it's guarded by roleMiddleware
        let whereClause = { isDeleted: false };
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
            prismaClient_1.default.activityLog.findMany({
                where: whereClause,
                include: {
                    user: { select: { id: true, name: true, email: true, role: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNumber
            }),
            prismaClient_1.default.activityLog.count({ where: whereClause })
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
        const logs = await prismaClient_1.default.activityLog.findMany({
            where: { userId: req.user.id, isDeleted: false },
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
// @desc    Delete activity log
// @route   DELETE /api/activity-logs/:id
// @access  Private
const deleteActivityLog = async (req, res) => {
    try {
        const log = await prismaClient_1.default.activityLog.findUnique({ where: { id: Number(req.params.id) } });
        if (!log)
            return res.status(404).json({ message: 'Log not found' });
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager' && log.userId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        await prismaClient_1.default.activityLog.update({ where: { id: Number(req.params.id) }, data: { isDeleted: true } });
        res.json({ message: 'Activity log deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteActivityLog = deleteActivityLog;
// @desc    Bulk delete activity logs
// @route   DELETE /api/activity-logs/bulk
// @access  Private
const bulkDeleteActivityLogs = async (req, res) => {
    try {
        const { ids } = req.body;
        let whereClause = {};
        if (ids && Array.isArray(ids) && ids.length > 0) {
            whereClause.id = { in: ids };
        }
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager') {
            whereClause.userId = req.user.id;
        }
        const deleted = await prismaClient_1.default.activityLog.updateMany({ where: whereClause, data: { isDeleted: true } });
        res.json({ message: `${deleted.count} logs deleted successfully` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.bulkDeleteActivityLogs = bulkDeleteActivityLogs;
