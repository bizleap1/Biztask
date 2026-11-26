"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHrDashboard = exports.getEmployeeDashboard = exports.getManagerDashboard = exports.getAdminDashboard = exports.calculatePerformanceScore = void 0;
const reportUtils_1 = require("../utils/reportUtils");
const prismaClient_1 = __importDefault(require("../prismaClient"));
// Helper to calculate performance score
const calculatePerformanceScore = (approved, overdue, rejected, totalTasks, attendanceRate = 100) => {
    const safeTotal = Math.max(0, totalTasks);
    const onTime = Math.max(0, approved - overdue);
    const onTimeRate = safeTotal > 0 ? onTime / safeTotal : 0;
    const completionRate = safeTotal > 0 ? approved / safeTotal : 0;
    const reworkPenalty = safeTotal > 0 ? rejected / safeTotal : 0;
    const attendance = Math.max(0, Math.min(100, attendanceRate)) / 100;
    const score = (onTimeRate * 40) + (completionRate * 30) + (attendance * 30) - (reworkPenalty * 10);
    return Math.round(Math.max(0, Math.min(100, score)));
};
exports.calculatePerformanceScore = calculatePerformanceScore;
// Helper for date filtering
const getDateFilter = (startDate, endDate) => {
    if (startDate && endDate) {
        return {
            gte: new Date(startDate),
            lte: new Date(endDate + 'T23:59:59.999Z')
        };
    }
    // Default to current month if no dates provided for some trend data
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return {
        gte: firstDay
    };
};
const getAdminDashboard = async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        // Filters
        const hasExplicitDates = Boolean(startDate && endDate);
        const dateFilter = getDateFilter(startDate, endDate);
        const createdAtFilter = hasExplicitDates ? { createdAt: dateFilter } : {};
        const reportDateFilter = hasExplicitDates ? { reportDate: dateFilter } : {};
        const deptFilter = department ? { department: { name: department } } : {};
        const taskDeptFilter = department ? { department: { name: department } } : {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tasksQuery = { where: { isDeleted: false, ...taskDeptFilter, ...createdAtFilter } };
        const [departments, totalEmployees, activeEmployees, devDept, mediaDept, managementCount, totalDailyReports, todayReports, expectedSubmitters, reportsNeedingCorrection, reviewedReports, taskStatusCounts, overdueTasksCount, overdueTaskList, pendingReviewSubmissions, recentTaskSubmissions, recentDailyReports, realActivityLogs, employees, upcomingDeadlines, departmentWiseTaskStatsRaw, departmentWiseOverdueRaw, departmentWiseReportStatsRaw, departmentWiseReportTodayRaw, taskGroups, overdueGroups, reportGroups] = await Promise.all([
            prismaClient_1.default.department.findMany(),
            prismaClient_1.default.user.count({ where: { role: { not: 'SuperAdmin' }, ...deptFilter } }),
            prismaClient_1.default.user.count({ where: { isActive: true, role: { not: 'SuperAdmin' }, ...deptFilter } }),
            prismaClient_1.default.department.findUnique({ where: { name: 'Development' } }),
            prismaClient_1.default.department.findUnique({ where: { name: 'Media' } }),
            prismaClient_1.default.user.count({ where: { role: { in: ['Manager', 'SuperAdmin'] } } }),
            prismaClient_1.default.dailyReport.count({ where: { isDeleted: false, ...deptFilter, ...reportDateFilter } }),
            prismaClient_1.default.dailyReport.count({ where: { isDeleted: false, ...deptFilter, reportDate: { gte: today, lt: tomorrow } } }),
            prismaClient_1.default.user.count({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
            prismaClient_1.default.dailyReport.count({ where: { isDeleted: false, ...deptFilter, ...reportDateFilter, status: 'Needs Correction' } }),
            prismaClient_1.default.dailyReport.count({ where: { isDeleted: false, ...deptFilter, ...reportDateFilter, status: 'Reviewed' } }),
            prismaClient_1.default.task.groupBy({ by: ['status'], where: tasksQuery.where, _count: { id: true } }),
            prismaClient_1.default.task.count({ where: { ...tasksQuery.where, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
            prismaClient_1.default.task.findMany({
                where: { ...tasksQuery.where, deadline: { lt: new Date() }, status: { not: 'Approved' } },
                include: { assignedTo: { select: { name: true } }, department: { select: { name: true } } },
                take: 5
            }),
            prismaClient_1.default.taskSubmission.count({ where: { isDeleted: false, reviewStatus: 'Pending Review', task: { isDeleted: false, ...taskDeptFilter } } }),
            prismaClient_1.default.taskSubmission.findMany({
                where: { isDeleted: false, task: { isDeleted: false, ...taskDeptFilter } },
                include: { user: { select: { name: true } }, task: { select: { title: true } } },
                orderBy: { submittedAt: 'desc' },
                take: 5
            }),
            prismaClient_1.default.dailyReport.findMany({
                where: { isDeleted: false, ...deptFilter, ...reportDateFilter },
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 5
            }),
            prismaClient_1.default.activityLog.findMany({
                where: { isDeleted: false },
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 8
            }),
            prismaClient_1.default.user.findMany({
                where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, ...deptFilter },
                include: { department: true }
            }),
            prismaClient_1.default.task.findMany({
                where: { ...tasksQuery.where, deadline: { gte: new Date() }, status: { not: 'Approved' } },
                orderBy: { deadline: 'asc' },
                take: 5,
                include: { assignedTo: { select: { name: true } } }
            }),
            prismaClient_1.default.task.groupBy({ by: ['departmentId', 'status'], where: { isDeleted: false, ...createdAtFilter }, _count: { id: true } }),
            prismaClient_1.default.task.groupBy({ by: ['departmentId'], where: { isDeleted: false, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
            prismaClient_1.default.dailyReport.groupBy({ by: ['departmentId'], where: { isDeleted: false, ...reportDateFilter }, _count: { id: true } }),
            prismaClient_1.default.dailyReport.groupBy({ by: ['departmentId'], where: { isDeleted: false, reportDate: { gte: today, lt: tomorrow } }, _count: { id: true } }),
            prismaClient_1.default.task.groupBy({ by: ['assignedToId', 'status'], where: { isDeleted: false, ...createdAtFilter }, _count: { id: true } }),
            prismaClient_1.default.task.groupBy({ by: ['assignedToId'], where: { isDeleted: false, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
            prismaClient_1.default.dailyReport.groupBy({ by: ['userId'], where: { isDeleted: false, ...reportDateFilter }, _count: { id: true } })
        ]);
        const totalTasks = taskStatusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
        const pendingTasks = taskStatusCounts.find((s) => s.status === 'Pending')?._count.id || 0;
        const inProgressTasks = taskStatusCounts.find((s) => s.status === 'In Progress')?._count.id || 0;
        const submittedTasks = taskStatusCounts.find((s) => s.status === 'Submitted')?._count.id || 0;
        const approvedTasks = taskStatusCounts.find((s) => s.status === 'Approved')?._count.id || 0;
        const rejectedTasks = taskStatusCounts.find((s) => s.status === 'Rejected')?._count.id || 0;
        const inactiveEmployees = totalEmployees - activeEmployees;
        // Fast follow-up queries
        const [developmentTeamCount, mediaTeamCount] = await Promise.all([
            devDept ? prismaClient_1.default.user.count({ where: { departmentId: devDept.id } }) : Promise.resolve(0),
            mediaDept ? prismaClient_1.default.user.count({ where: { departmentId: mediaDept.id } }) : Promise.resolve(0)
        ]);
        const missingReportsToday = Math.max(0, expectedSubmitters - todayReports);
        const recentActivityLogs = realActivityLogs.map((log) => {
            let msg = log.description || '';
            if (log.user && log.user.name) {
                if (msg.startsWith('User ')) {
                    msg = msg.replace(/^User /, `${log.user.name} `);
                }
                else {
                    msg = `${log.user.name} ${msg.charAt(0).toLowerCase() + msg.slice(1)}`;
                }
            }
            return {
                type: log.action,
                message: msg,
                date: log.createdAt
            };
        });
        const departmentWiseTaskStats = departments.map((dept) => {
            const stats = departmentWiseTaskStatsRaw.filter((g) => g.departmentId === dept.id);
            const overdueStats = departmentWiseOverdueRaw.find((g) => g.departmentId === dept.id);
            const total = stats.reduce((sum, g) => sum + g._count.id, 0);
            const approved = stats.find((g) => g.status === 'Approved')?._count.id || 0;
            const overdue = overdueStats?._count.id || 0;
            return { name: dept.name, total, approved, overdue };
        });
        const departmentWiseReportStats = departments.map((dept) => {
            const total = departmentWiseReportStatsRaw.find((g) => g.departmentId === dept.id)?._count.id || 0;
            const todayCount = departmentWiseReportTodayRaw.find((g) => g.departmentId === dept.id)?._count.id || 0;
            return { name: dept.name, total, today: todayCount };
        });
        const employeePerformanceSummary = employees.map((emp) => {
            const empTaskGroups = taskGroups.filter((g) => g.assignedToId === emp.id);
            const empTotalTasks = empTaskGroups.reduce((sum, g) => sum + g._count.id, 0);
            const empApprovedTasks = empTaskGroups.find((g) => g.status === 'Approved')?._count.id || 0;
            const empRejectedTasks = empTaskGroups.find((g) => g.status === 'Rejected')?._count.id || 0;
            const empOverdueTasks = overdueGroups.find((g) => g.assignedToId === emp.id)?._count.id || 0;
            const empDailyReports = reportGroups.find((g) => g.userId === emp.id)?._count.id || 0;
            return {
                id: emp.id,
                name: emp.name,
                department: emp.department?.name || 'N/A',
                totalTasks: empTotalTasks,
                approved: empApprovedTasks,
                rejected: empRejectedTasks,
                overdue: empOverdueTasks,
                reportsSubmitted: empDailyReports,
                score: (0, exports.calculatePerformanceScore)(empApprovedTasks, empOverdueTasks, empRejectedTasks, empTotalTasks, 100)
            };
        });
        const [atRiskSetting, atRiskClientsRaw] = await Promise.all([
            prismaClient_1.default.setting.findUnique({ where: { key: 'client_at_risk_overdue_threshold' } }),
            prismaClient_1.default.client.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    tasks: {
                        where: {
                            isDeleted: false,
                            status: { not: 'Approved' },
                            deadline: { lt: new Date() }
                        },
                        select: {
                            id: true,
                            title: true,
                            deadline: true,
                            assignedTo: { select: { id: true, name: true } }
                        },
                        orderBy: { deadline: 'asc' }
                    }
                }
            })
        ]);
        const parsedThreshold = Number(atRiskSetting?.value);
        const atRiskThreshold = Number.isInteger(parsedThreshold) && parsedThreshold >= 1 ? parsedThreshold : 3;
        const atRiskClients = atRiskClientsRaw
            .map((client) => ({
            id: client.id,
            name: client.name,
            status: client.status,
            overdueTaskCount: client.tasks.length,
            overdueTasks: client.tasks
        }))
            .filter((client) => client.status === 'At-Risk' || client.overdueTaskCount >= atRiskThreshold);
        const responseData = {
            totalEmployees, activeEmployees, inactiveEmployees,
            developmentTeamCount, mediaTeamCount, managementCount,
            totalTasks, pendingTasks, inProgressTasks, submittedTasks, approvedTasks, rejectedTasks, overdueTasks: overdueTasksCount,
            totalDailyReports, todayReports, missingReportsToday, reportsNeedingCorrection, reviewedReports,
            pendingReviewSubmissions, recentTaskSubmissions, recentDailyReports, recentActivityLogs,
            departmentWiseTaskStats, departmentWiseReportStats, employeePerformanceSummary, upcomingDeadlines, overdueTaskList,
            atRiskThreshold, atRiskClients
        };
        res.json(responseData);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error loading admin dashboard' });
    }
};
exports.getAdminDashboard = getAdminDashboard;
const getManagerDashboard = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const hasExplicitDates = Boolean(startDate && endDate);
        const dateFilter = getDateFilter(startDate, endDate);
        const createdAtFilter = hasExplicitDates ? { createdAt: dateFilter } : {};
        const reportDateFilter = hasExplicitDates ? { reportDate: dateFilter } : {};
        const deptFilter = req.user?.departmentId ? { departmentId: req.user.departmentId } : {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [teamEmployees, activeTeamEmployees, todayTeamReports, expectedSubmitters, reportsNeedingCorrection, employees, taskStatusCounts, overdueTeamTasks, overdueTeamTaskList, pendingReviewSubmissions, recentTeamSubmissions, recentTeamReports, realActivityLogs, upcomingTeamDeadlines, teamTaskGroups, teamOverdueGroups, teamReportGroups] = await Promise.all([
            prismaClient_1.default.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] } } }),
            prismaClient_1.default.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
            prismaClient_1.default.dailyReport.count({ where: { isDeleted: false, ...deptFilter, reportDate: { gte: today, lt: tomorrow } } }),
            prismaClient_1.default.user.count({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
            prismaClient_1.default.dailyReport.count({ where: { isDeleted: false, ...deptFilter, ...reportDateFilter, status: 'Needs Correction' } }),
            prismaClient_1.default.user.findMany({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] } } }),
            prismaClient_1.default.task.groupBy({ by: ['status'], where: { isDeleted: false, ...deptFilter, ...createdAtFilter }, _count: { id: true } }),
            prismaClient_1.default.task.count({ where: { isDeleted: false, ...deptFilter, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
            prismaClient_1.default.task.findMany({
                where: { isDeleted: false, ...deptFilter, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } },
                include: { assignedTo: { select: { name: true } } },
                take: 5
            }),
            prismaClient_1.default.taskSubmission.count({ where: { isDeleted: false, task: { isDeleted: false, ...deptFilter }, reviewStatus: 'Pending Review' } }),
            prismaClient_1.default.taskSubmission.findMany({
                where: { isDeleted: false, task: { isDeleted: false, ...deptFilter } },
                include: { user: { select: { name: true } }, task: { select: { title: true } } },
                orderBy: { submittedAt: 'desc' },
                take: 5
            }),
            prismaClient_1.default.dailyReport.findMany({
                where: { isDeleted: false, ...deptFilter, ...reportDateFilter },
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 5
            }),
            prismaClient_1.default.activityLog.findMany({
                where: { isDeleted: false },
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 8
            }),
            prismaClient_1.default.task.findMany({
                where: { isDeleted: false, ...deptFilter, ...createdAtFilter, deadline: { gte: new Date() }, status: { not: 'Approved' } },
                orderBy: { deadline: 'asc' },
                take: 5,
                include: { assignedTo: { select: { name: true } } }
            }),
            prismaClient_1.default.task.groupBy({ by: ['assignedToId', 'status'], where: { isDeleted: false, ...createdAtFilter }, _count: { id: true } }),
            prismaClient_1.default.task.groupBy({ by: ['assignedToId'], where: { isDeleted: false, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
            prismaClient_1.default.dailyReport.groupBy({ by: ['userId'], where: { isDeleted: false, ...reportDateFilter }, _count: { id: true } })
        ]);
        const totalTeamTasks = taskStatusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
        const pendingTeamTasks = taskStatusCounts.find((s) => s.status === 'Pending')?._count.id || 0;
        const inProgressTeamTasks = taskStatusCounts.find((s) => s.status === 'In Progress')?._count.id || 0;
        const submittedTeamTasks = taskStatusCounts.find((s) => s.status === 'Submitted')?._count.id || 0;
        const approvedTeamTasks = taskStatusCounts.find((s) => s.status === 'Approved')?._count.id || 0;
        const rejectedTeamTasks = taskStatusCounts.find((s) => s.status === 'Rejected')?._count.id || 0;
        const inactiveTeamEmployees = teamEmployees - activeTeamEmployees;
        const missingTeamReportsToday = Math.max(0, expectedSubmitters - todayTeamReports);
        const recentActivityLogs = realActivityLogs.map((log) => {
            let msg = log.description || '';
            if (log.user && log.user.name) {
                if (msg.startsWith('User ')) {
                    msg = msg.replace(/^User /, `${log.user.name} `);
                }
                else {
                    msg = `${log.user.name} ${msg.charAt(0).toLowerCase() + msg.slice(1)}`;
                }
            }
            return {
                type: log.action,
                message: msg,
                date: log.createdAt
            };
        });
        const teamPerformanceSummary = employees.map((emp) => {
            const empTaskGroups = teamTaskGroups.filter((g) => g.assignedToId === emp.id);
            const empTotalTasks = empTaskGroups.reduce((sum, g) => sum + g._count.id, 0);
            const empApprovedTasks = empTaskGroups.find((g) => g.status === 'Approved')?._count.id || 0;
            const empRejectedTasks = empTaskGroups.find((g) => g.status === 'Rejected')?._count.id || 0;
            const empOverdueTasks = teamOverdueGroups.find((g) => g.assignedToId === emp.id)?._count.id || 0;
            const empDailyReports = teamReportGroups.find((g) => g.userId === emp.id)?._count.id || 0;
            return {
                id: emp.id,
                name: emp.name,
                totalTasks: empTotalTasks,
                approved: empApprovedTasks,
                rejected: empRejectedTasks,
                overdue: empOverdueTasks,
                reportsSubmitted: empDailyReports,
                score: (0, exports.calculatePerformanceScore)(empApprovedTasks, empOverdueTasks, empRejectedTasks, empTotalTasks, 100)
            };
        });
        const departmentTaskStats = {
            total: totalTeamTasks,
            approved: approvedTeamTasks,
            overdue: overdueTeamTasks,
            pending: pendingTeamTasks
        };
        const responseData = {
            teamEmployees, activeTeamEmployees, inactiveTeamEmployees,
            totalTeamTasks, pendingTeamTasks, inProgressTeamTasks, submittedTeamTasks, approvedTeamTasks, rejectedTeamTasks, overdueTeamTasks,
            todayTeamReports, missingTeamReportsToday, reportsNeedingCorrection,
            pendingReviewSubmissions, recentTeamSubmissions, recentTeamReports, recentActivityLogs,
            teamPerformanceSummary, upcomingTeamDeadlines, overdueTeamTaskList, departmentTaskStats
        };
        res.json(responseData);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error loading manager dashboard' });
    }
};
exports.getManagerDashboard = getManagerDashboard;
const getEmployeeDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const taskStatusCounts = await prismaClient_1.default.task.groupBy({
            by: ['status'],
            where: { assignedToId: userId, isDeleted: false },
            _count: { id: true }
        });
        const myTotalTasks = taskStatusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
        const myPendingTasks = taskStatusCounts.find((s) => s.status === 'Pending')?._count.id || 0;
        const myInProgressTasks = taskStatusCounts.find((s) => s.status === 'In Progress')?._count.id || 0;
        const mySubmittedTasks = taskStatusCounts.find((s) => s.status === 'Submitted')?._count.id || 0;
        const myApprovedTasks = taskStatusCounts.find((s) => s.status === 'Approved')?._count.id || 0;
        const myRejectedTasks = taskStatusCounts.find((s) => s.status === 'Rejected')?._count.id || 0;
        const [myOverdueTasks, todayReport, myRecentTasks, myUpcomingDeadlines, myRejectedTasksWithFeedback, myRecentDailyReports, user] = await Promise.all([
            prismaClient_1.default.task.count({ where: { assignedToId: userId, isDeleted: false, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
            prismaClient_1.default.dailyReport.findFirst({ where: { userId, isDeleted: false, reportDate: { gte: today, lt: tomorrow } } }),
            prismaClient_1.default.task.findMany({ where: { assignedToId: userId, isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 5 }),
            prismaClient_1.default.task.findMany({ where: { assignedToId: userId, isDeleted: false, deadline: { gte: new Date() }, status: { not: 'Approved' } }, orderBy: { deadline: 'asc' }, take: 5 }),
            prismaClient_1.default.taskSubmission.findMany({ where: { userId, isDeleted: false, reviewStatus: 'Rejected', task: { isDeleted: false } }, include: { task: true }, orderBy: { reviewedAt: 'desc' }, take: 3 }),
            prismaClient_1.default.dailyReport.findMany({ where: { userId, isDeleted: false }, orderBy: { reportDate: 'desc' }, take: 5 }),
            prismaClient_1.default.user.findUnique({ where: { id: userId } })
        ]);
        const todayReportStatus = todayReport ? todayReport.status : 'Missing';
        const latestManagerFeedback = todayReport?.managerFeedback || null;
        const myTaskCompletionRate = myTotalTasks > 0 ? ((myApprovedTasks / myTotalTasks) * 100).toFixed(1) : 0;
        let myReportSubmissionRate = 0;
        if (user) {
            myReportSubmissionRate = Number(await (0, reportUtils_1.calculateMonthlyReportRate)(userId));
        }
        const responseData = {
            myTotalTasks, myPendingTasks, myInProgressTasks, mySubmittedTasks, myApprovedTasks, myRejectedTasks, myOverdueTasks,
            todayReportStatus, latestManagerFeedback,
            myRecentTasks, myUpcomingDeadlines, myRejectedTasksWithFeedback, myRecentDailyReports,
            myTaskCompletionRate, myReportSubmissionRate
        };
        res.json(responseData);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error loading employee dashboard' });
    }
};
exports.getEmployeeDashboard = getEmployeeDashboard;
const getHrDashboard = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [totalEmployees, activeEmployees, departments, expectedSubmitters, todayReports, totalTasks, approvedTasks, recentReports] = await Promise.all([
            prismaClient_1.default.user.count(),
            prismaClient_1.default.user.count({ where: { isActive: true } }),
            prismaClient_1.default.department.findMany(),
            prismaClient_1.default.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
            prismaClient_1.default.dailyReport.count({ where: { isDeleted: false, reportDate: { gte: today, lt: tomorrow } } }),
            prismaClient_1.default.task.count({ where: { isDeleted: false } }),
            prismaClient_1.default.task.count({ where: { isDeleted: false, status: 'Approved' } }),
            prismaClient_1.default.dailyReport.findMany({
                where: { isDeleted: false },
                include: { user: { select: { name: true } }, department: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 10
            })
        ]);
        const inactiveEmployees = totalEmployees - activeEmployees;
        const departmentUserCountsRaw = await prismaClient_1.default.user.groupBy({
            by: ['departmentId'],
            _count: { id: true }
        });
        const departmentWiseEmployees = departments.map((dept) => ({
            name: dept.name,
            count: departmentUserCountsRaw.find((g) => g.departmentId === dept.id)?._count.id || 0
        }));
        const dailyReportCompliance = expectedSubmitters > 0 ? ((todayReports / expectedSubmitters) * 100).toFixed(1) : 0;
        const taskCompletionOverview = totalTasks > 0 ? ((approvedTasks / totalTasks) * 100).toFixed(1) : 0;
        const responseData = {
            totalEmployees, activeEmployees, inactiveEmployees,
            departmentWiseEmployees, dailyReportCompliance, taskCompletionOverview, recentReports
        };
        res.json(responseData);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error loading HR dashboard' });
    }
};
exports.getHrDashboard = getHrDashboard;
