"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteReports = exports.deleteReport = exports.markNeedsCorrection = exports.reviewReport = exports.updateReport = exports.getReportById = exports.getMyReports = exports.getAllReports = exports.submitReport = void 0;
const activityLogUtils_1 = require("../utils/activityLogUtils");
const notificationUtils_1 = require("../utils/notificationUtils");
const reportUtils_1 = require("../utils/reportUtils");
const prismaClient_1 = __importDefault(require("../prismaClient"));
// @desc    Submit a daily report
// @route   POST /api/daily-reports
// @access  Private (Employee)
const submitReport = async (req, res) => {
    try {
        const { reportDate, workCompleted, pendingWork, blockers, tomorrowPlan, attachments, taskIds } = req.body;
        const userId = req.user.id;
        const departmentId = req.user.departmentId;
        if (!departmentId) {
            return res.status(400).json({ message: 'User does not belong to a department' });
        }
        // Check for duplicate report on the same date (excluding soft-deleted)
        const dateObj = new Date(reportDate);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ message: 'Valid report date is required' });
        }
        const startOfDay = new Date(dateObj);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateObj);
        endOfDay.setHours(23, 59, 59, 999);
        const existingReport = await prismaClient_1.default.dailyReport.findFirst({
            where: {
                userId,
                isDeleted: false,
                reportDate: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });
        if (existingReport) {
            return res.status(400).json({ message: 'Daily report already submitted for this date.' });
        }
        const report = await prismaClient_1.default.dailyReport.create({
            data: {
                userId,
                departmentId,
                reportDate: startOfDay,
                workCompleted,
                pendingWork,
                blockers: blockers || null,
                tomorrowPlan,
                attachments,
                taskIds: taskIds ? JSON.stringify(taskIds) : null,
                status: 'Submitted'
            }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId,
            action: 'DAILY_REPORT_SUBMITTED',
            entityType: 'DailyReport',
            entityId: report.id,
            description: `Submitted daily report for ${reportDate}`,
            req
        });
        const admins = await prismaClient_1.default.user.findMany({
            where: { role: { in: ['SuperAdmin', 'Manager'] } },
            select: { id: true }
        });
        for (const admin of admins) {
            await (0, notificationUtils_1.createNotification)({
                userId: admin.id,
                title: 'Daily Report Submitted',
                message: `Daily report submitted by user ID ${userId}`,
                type: 'daily_report_submitted',
                entityType: 'DailyReport',
                entityId: report.id
            });
        }
        res.status(201).json(report);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.submitReport = submitReport;
// @desc    Get all reports (with filters)
// @route   GET /api/daily-reports
// @access  Private (SuperAdmin, Manager)
const getAllReports = async (req, res) => {
    try {
        const { employeeId, departmentId, status, startDate, endDate } = req.query;
        const { role, departmentId: userDeptId } = req.user;
        let whereClause = { isDeleted: false };
        // Managers and SuperAdmins can see all departments
        if (departmentId) {
            whereClause.departmentId = Number(departmentId);
        }
        if (employeeId) {
            whereClause.userId = Number(employeeId);
        }
        if (status) {
            whereClause.status = status;
        }
        if (startDate || endDate) {
            whereClause.reportDate = {};
            if (startDate)
                whereClause.reportDate.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.reportDate.lte = end;
            }
        }
        const reports = await prismaClient_1.default.dailyReport.findMany({
            where: whereClause,
            include: {
                user: { select: { id: true, name: true, role: true, email: true } },
                department: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } }
            },
            orderBy: { reportDate: 'desc' }
        });
        // Fetch live monthly submission rate once per unique user (fixes N+1)
        const uniqueUserIds = Array.from(new Set(reports.map(r => r.userId)));
        const rateEntries = await Promise.all(uniqueUserIds.map(async (uid) => [uid, await (0, reportUtils_1.calculateMonthlyReportRate)(uid)]));
        const rateMap = new Map(rateEntries);
        const reportsWithRates = reports.map(report => ({
            ...report,
            user: { ...report.user, reportSubmissionRate: rateMap.get(report.userId) ?? '0.0' }
        }));
        res.json(reportsWithRates);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getAllReports = getAllReports;
// @desc    Get my reports
// @route   GET /api/daily-reports/my
// @access  Private
const getMyReports = async (req, res) => {
    try {
        const reports = await prismaClient_1.default.dailyReport.findMany({
            where: { userId: req.user.id, isDeleted: false },
            include: {
                department: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } }
            },
            orderBy: { reportDate: 'desc' }
        });
        res.json(reports);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMyReports = getMyReports;
// @desc    Get single report
// @route   GET /api/daily-reports/:id
// @access  Private
const getReportById = async (req, res) => {
    try {
        const reportId = Number(req.params.id);
        if (isNaN(reportId))
            return res.status(400).json({ message: 'Invalid report ID' });
        const report = await prismaClient_1.default.dailyReport.findFirst({
            where: { id: reportId, isDeleted: false },
            include: {
                user: { select: { id: true, name: true, email: true, role: true, designation: true } },
                department: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } }
            }
        });
        if (!report)
            return res.status(404).json({ message: 'Report not found' });
        // Authorization
        const { id, role, departmentId } = req.user;
        if (role === 'Viewer')
            return res.status(403).json({ message: 'Forbidden' });
        if (role !== 'SuperAdmin' && role !== 'Manager' && report.userId !== id)
            return res.status(403).json({ message: 'Forbidden' });
        res.json(report);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getReportById = getReportById;
// @desc    Update my report
// @route   PUT /api/daily-reports/:id
// @access  Private (Employee)
const updateReport = async (req, res) => {
    try {
        const reportId = Number(req.params.id);
        const report = await prismaClient_1.default.dailyReport.findUnique({ where: { id: reportId } });
        if (!report)
            return res.status(404).json({ message: 'Report not found' });
        if (report.userId !== req.user.id)
            return res.status(403).json({ message: 'Forbidden' });
        if (report.status === 'Reviewed')
            return res.status(400).json({ message: 'Cannot edit a reviewed report' });
        const { workCompleted, pendingWork, blockers, tomorrowPlan, attachments, taskIds } = req.body;
        const updated = await prismaClient_1.default.dailyReport.update({
            where: { id: reportId },
            data: {
                workCompleted,
                pendingWork,
                blockers,
                tomorrowPlan,
                attachments,
                taskIds: taskIds ? JSON.stringify(taskIds) : null,
                status: 'Submitted' // Reset status if it was Needs Correction
            }
        });
        res.json(updated);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateReport = updateReport;
// @desc    Review report
// @route   PATCH /api/daily-reports/:id/review
// @access  Private (SuperAdmin, Manager)
const reviewReport = async (req, res) => {
    try {
        const reportId = Number(req.params.id);
        if (isNaN(reportId))
            return res.status(400).json({ message: 'Invalid report ID' });
        const { managerFeedback } = req.body;
        const existing = await prismaClient_1.default.dailyReport.findFirst({ where: { id: reportId, isDeleted: false } });
        if (!existing)
            return res.status(404).json({ message: 'Report not found' });
        const updated = await prismaClient_1.default.dailyReport.update({
            where: { id: reportId },
            data: {
                status: 'Reviewed',
                managerFeedback,
                reviewedById: req.user.id,
                reviewedAt: new Date()
            }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'DAILY_REPORT_REVIEWED',
            entityType: 'DailyReport',
            entityId: updated.id,
            description: `Reviewed daily report ID ${reportId}`,
            req
        });
        await (0, notificationUtils_1.createNotification)({
            userId: updated.userId,
            title: 'Daily Report Reviewed',
            message: 'Your daily report has been reviewed.',
            type: 'daily_report_reviewed',
            entityType: 'DailyReport',
            entityId: updated.id
        });
        res.json(updated);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.reviewReport = reviewReport;
// @desc    Mark report as needs correction
// @route   PATCH /api/daily-reports/:id/needs-correction
// @access  Private (SuperAdmin, Manager)
const markNeedsCorrection = async (req, res) => {
    try {
        const reportId = Number(req.params.id);
        if (isNaN(reportId))
            return res.status(400).json({ message: 'Invalid report ID' });
        const { managerFeedback } = req.body;
        if (!managerFeedback) {
            return res.status(400).json({ message: 'Feedback is required for corrections' });
        }
        const existing = await prismaClient_1.default.dailyReport.findFirst({ where: { id: reportId, isDeleted: false } });
        if (!existing)
            return res.status(404).json({ message: 'Report not found' });
        const updated = await prismaClient_1.default.dailyReport.update({
            where: { id: reportId },
            data: {
                status: 'Needs Correction',
                managerFeedback,
                reviewedById: req.user.id,
                reviewedAt: new Date()
            }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'DAILY_REPORT_NEEDS_CORRECTION',
            entityType: 'DailyReport',
            entityId: updated.id,
            description: `Marked daily report ID ${reportId} as needs correction`,
            req
        });
        await (0, notificationUtils_1.createNotification)({
            userId: updated.userId,
            title: 'Daily Report Needs Correction',
            message: 'Your daily report needs correction. Please check feedback.',
            type: 'daily_report_correction',
            entityType: 'DailyReport',
            entityId: updated.id
        });
        res.json(updated);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markNeedsCorrection = markNeedsCorrection;
// @desc    Delete/Archive report
// @route   DELETE /api/daily-reports/:id
// @access  Private
const deleteReport = async (req, res) => {
    try {
        const report = await prismaClient_1.default.dailyReport.findUnique({ where: { id: Number(req.params.id) } });
        if (!report)
            return res.status(404).json({ message: 'Report not found' });
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager' && report.userId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        await prismaClient_1.default.dailyReport.update({ where: { id: Number(req.params.id) }, data: { isDeleted: true } });
        res.json({ message: 'Report deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteReport = deleteReport;
// @desc    Bulk delete reports
// @route   DELETE /api/daily-reports/bulk
// @access  Private
const bulkDeleteReports = async (req, res) => {
    try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'A non-empty array of report IDs is required' });
        }
        const numericIds = ids.map(Number).filter(n => !isNaN(n));
        if (numericIds.length === 0) {
            return res.status(400).json({ message: 'Valid report IDs are required' });
        }
        const whereClause = { id: { in: numericIds }, isDeleted: false };
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager') {
            whereClause.userId = req.user.id;
        }
        const deleted = await prismaClient_1.default.dailyReport.updateMany({ where: whereClause, data: { isDeleted: true } });
        res.json({ message: `${deleted.count} reports deleted successfully` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.bulkDeleteReports = bulkDeleteReports;
