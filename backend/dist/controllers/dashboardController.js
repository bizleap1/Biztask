"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHrDashboard = exports.getEmployeeDashboard = exports.getManagerDashboard = exports.getAdminDashboard = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Helper to calculate performance score
const calculatePerformanceScore = (approved, overdue, rejected, dailyReports) => {
    // Simple formula as requested
    const score = (approved * 10) - (overdue * 5) - (rejected * 3) + (dailyReports * 2);
    return Math.max(0, score); // Prevent negative score
};
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
        const dateFilter = getDateFilter(startDate, endDate);
        const deptFilter = department ? { department: { name: department } } : {};
        const taskDeptFilter = department ? { department: { name: department } } : {};
        // 1. Employee Stats
        const totalEmployees = await prisma.user.count({ where: { ...deptFilter } });
        const activeEmployees = await prisma.user.count({ where: { isActive: true, ...deptFilter } });
        const inactiveEmployees = totalEmployees - activeEmployees;
        const devDept = await prisma.department.findUnique({ where: { name: 'Development' } });
        const mediaDept = await prisma.department.findUnique({ where: { name: 'Media' } });
        const developmentTeamCount = devDept ? await prisma.user.count({ where: { departmentId: devDept.id } }) : 0;
        const mediaTeamCount = mediaDept ? await prisma.user.count({ where: { departmentId: mediaDept.id } }) : 0;
        const managementCount = await prisma.user.count({ where: { role: { in: ['Manager', 'SuperAdmin'] } } });
        // 2. Task Stats
        const tasksQuery = { where: { ...taskDeptFilter } };
        const totalTasks = await prisma.task.count(tasksQuery);
        const pendingTasks = await prisma.task.count({ where: { ...tasksQuery.where, status: 'Pending' } });
        const inProgressTasks = await prisma.task.count({ where: { ...tasksQuery.where, status: 'In Progress' } });
        const submittedTasks = await prisma.task.count({ where: { ...tasksQuery.where, status: 'Submitted' } });
        const approvedTasks = await prisma.task.count({ where: { ...tasksQuery.where, status: 'Approved' } });
        const rejectedTasks = await prisma.task.count({ where: { ...tasksQuery.where, status: 'Rejected' } });
        const overdueTasksCount = await prisma.task.count({
            where: {
                ...tasksQuery.where,
                deadline: { lt: new Date() },
                status: { not: 'Approved' }
            }
        });
        const overdueTaskList = await prisma.task.findMany({
            where: {
                ...tasksQuery.where,
                deadline: { lt: new Date() },
                status: { not: 'Approved' }
            },
            include: { assignedTo: { select: { name: true } }, department: { select: { name: true } } },
            take: 5
        });
        // 3. Daily Report Stats
        const totalDailyReports = await prisma.dailyReport.count({ where: { ...deptFilter } });
        // Today logic
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayReports = await prisma.dailyReport.count({
            where: {
                ...deptFilter,
                reportDate: { gte: today, lt: tomorrow }
            }
        });
        // Employees expected to submit (excluding SuperAdmin/Viewer)
        const expectedSubmitters = await prisma.user.count({
            where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true }
        });
        const missingReportsToday = Math.max(0, expectedSubmitters - todayReports);
        const reportsNeedingCorrection = await prisma.dailyReport.count({ where: { ...deptFilter, status: 'Needs Correction' } });
        const reviewedReports = await prisma.dailyReport.count({ where: { ...deptFilter, status: 'Reviewed' } });
        // 4. Pending Review Submissions
        const pendingReviewSubmissions = await prisma.taskSubmission.count({
            where: { reviewStatus: 'Pending Review', task: taskDeptFilter }
        });
        // 5. Recent Activity
        const recentTaskSubmissions = await prisma.taskSubmission.findMany({
            where: { task: taskDeptFilter },
            include: { user: { select: { name: true } }, task: { select: { title: true } } },
            orderBy: { submittedAt: 'desc' },
            take: 5
        });
        const recentDailyReports = await prisma.dailyReport.findMany({
            where: { ...deptFilter },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        const realActivityLogs = await prisma.activityLog.findMany({
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 8
        });
        const recentActivityLogs = realActivityLogs.map(log => ({
            type: log.action,
            message: log.description,
            date: log.createdAt
        }));
        // 6. Department Wise Stats
        const departments = await prisma.department.findMany();
        const departmentWiseTaskStats = await Promise.all(departments.map(async (dept) => ({
            name: dept.name,
            total: await prisma.task.count({ where: { departmentId: dept.id } }),
            approved: await prisma.task.count({ where: { departmentId: dept.id, status: 'Approved' } }),
            overdue: await prisma.task.count({ where: { departmentId: dept.id, deadline: { lt: new Date() }, status: { not: 'Approved' } } })
        })));
        const departmentWiseReportStats = await Promise.all(departments.map(async (dept) => ({
            name: dept.name,
            total: await prisma.dailyReport.count({ where: { departmentId: dept.id } }),
            today: await prisma.dailyReport.count({ where: { departmentId: dept.id, reportDate: { gte: today, lt: tomorrow } } })
        })));
        // 7. Employee Performance Summary
        const employees = await prisma.user.findMany({
            where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, ...deptFilter },
            include: { department: true }
        });
        const employeePerformanceSummary = await Promise.all(employees.map(async (emp) => {
            const empTotalTasks = await prisma.task.count({ where: { assignedToId: emp.id } });
            const empApprovedTasks = await prisma.task.count({ where: { assignedToId: emp.id, status: 'Approved' } });
            const empRejectedTasks = await prisma.task.count({ where: { assignedToId: emp.id, status: 'Rejected' } });
            const empOverdueTasks = await prisma.task.count({ where: { assignedToId: emp.id, deadline: { lt: new Date() }, status: { not: 'Approved' } } });
            const empDailyReports = await prisma.dailyReport.count({ where: { userId: emp.id } });
            return {
                id: emp.id,
                name: emp.name,
                department: emp.department?.name || 'N/A',
                totalTasks: empTotalTasks,
                approved: empApprovedTasks,
                rejected: empRejectedTasks,
                overdue: empOverdueTasks,
                reportsSubmitted: empDailyReports,
                score: calculatePerformanceScore(empApprovedTasks, empOverdueTasks, empRejectedTasks, empDailyReports)
            };
        }));
        const upcomingDeadlines = await prisma.task.findMany({
            where: { ...tasksQuery.where, deadline: { gte: new Date() }, status: { not: 'Approved' } },
            orderBy: { deadline: 'asc' },
            take: 5,
            include: { assignedTo: { select: { name: true } } }
        });
        res.json({
            totalEmployees, activeEmployees, inactiveEmployees,
            developmentTeamCount, mediaTeamCount, managementCount,
            totalTasks, pendingTasks, inProgressTasks, submittedTasks, approvedTasks, rejectedTasks, overdueTasks: overdueTasksCount,
            totalDailyReports, todayReports, missingReportsToday, reportsNeedingCorrection, reviewedReports,
            pendingReviewSubmissions, recentTaskSubmissions, recentDailyReports, recentActivityLogs,
            departmentWiseTaskStats, departmentWiseReportStats, employeePerformanceSummary, upcomingDeadlines, overdueTaskList
        });
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
        const dateFilter = getDateFilter(startDate, endDate);
        const deptFilter = {};
        const teamEmployees = await prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] } } });
        const activeTeamEmployees = await prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } });
        const inactiveTeamEmployees = teamEmployees - activeTeamEmployees;
        const totalTeamTasks = await prisma.task.count({ where: deptFilter });
        const pendingTeamTasks = await prisma.task.count({ where: { ...deptFilter, status: 'Pending' } });
        const inProgressTeamTasks = await prisma.task.count({ where: { ...deptFilter, status: 'In Progress' } });
        const submittedTeamTasks = await prisma.task.count({ where: { ...deptFilter, status: 'Submitted' } });
        const approvedTeamTasks = await prisma.task.count({ where: { ...deptFilter, status: 'Approved' } });
        const rejectedTeamTasks = await prisma.task.count({ where: { ...deptFilter, status: 'Rejected' } });
        const overdueTeamTasks = await prisma.task.count({
            where: { ...deptFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } }
        });
        const overdueTeamTaskList = await prisma.task.findMany({
            where: { ...deptFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } },
            include: { assignedTo: { select: { name: true } } },
            take: 5
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayTeamReports = await prisma.dailyReport.count({
            where: { ...deptFilter, reportDate: { gte: today, lt: tomorrow } }
        });
        const expectedSubmitters = await prisma.user.count({
            where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true }
        });
        const missingTeamReportsToday = Math.max(0, expectedSubmitters - todayTeamReports);
        const reportsNeedingCorrection = await prisma.dailyReport.count({ where: { ...deptFilter, status: 'Needs Correction' } });
        const pendingReviewSubmissions = await prisma.taskSubmission.count({
            where: { task: deptFilter, reviewStatus: 'Pending Review' }
        });
        const recentTeamSubmissions = await prisma.taskSubmission.findMany({
            where: { task: deptFilter },
            include: { user: { select: { name: true } }, task: { select: { title: true } } },
            orderBy: { submittedAt: 'desc' },
            take: 5
        });
        const recentTeamReports = await prisma.dailyReport.findMany({
            where: deptFilter,
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        const realActivityLogs = await prisma.activityLog.findMany({
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 8
        });
        const recentActivityLogs = realActivityLogs.map(log => ({
            type: log.action,
            message: log.description,
            date: log.createdAt
        }));
        const employees = await prisma.user.findMany({
            where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] } }
        });
        const teamPerformanceSummary = await Promise.all(employees.map(async (emp) => {
            const empTotalTasks = await prisma.task.count({ where: { assignedToId: emp.id } });
            const empApprovedTasks = await prisma.task.count({ where: { assignedToId: emp.id, status: 'Approved' } });
            const empRejectedTasks = await prisma.task.count({ where: { assignedToId: emp.id, status: 'Rejected' } });
            const empOverdueTasks = await prisma.task.count({ where: { assignedToId: emp.id, deadline: { lt: new Date() }, status: { not: 'Approved' } } });
            const empDailyReports = await prisma.dailyReport.count({ where: { userId: emp.id } });
            return {
                id: emp.id,
                name: emp.name,
                totalTasks: empTotalTasks,
                approved: empApprovedTasks,
                rejected: empRejectedTasks,
                overdue: empOverdueTasks,
                reportsSubmitted: empDailyReports,
                score: calculatePerformanceScore(empApprovedTasks, empOverdueTasks, empRejectedTasks, empDailyReports)
            };
        }));
        const upcomingTeamDeadlines = await prisma.task.findMany({
            where: { ...deptFilter, deadline: { gte: new Date() }, status: { not: 'Approved' } },
            orderBy: { deadline: 'asc' },
            take: 5,
            include: { assignedTo: { select: { name: true } } }
        });
        const departmentTaskStats = {
            total: totalTeamTasks,
            approved: approvedTeamTasks,
            overdue: overdueTeamTasks,
            pending: pendingTeamTasks
        };
        res.json({
            teamEmployees, activeTeamEmployees, inactiveTeamEmployees,
            totalTeamTasks, pendingTeamTasks, inProgressTeamTasks, submittedTeamTasks, approvedTeamTasks, rejectedTeamTasks, overdueTeamTasks,
            todayTeamReports, missingTeamReportsToday, reportsNeedingCorrection,
            pendingReviewSubmissions, recentTeamSubmissions, recentTeamReports, recentActivityLogs,
            teamPerformanceSummary, upcomingTeamDeadlines, overdueTeamTaskList, departmentTaskStats
        });
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
        const myTotalTasks = await prisma.task.count({ where: { assignedToId: userId } });
        const myPendingTasks = await prisma.task.count({ where: { assignedToId: userId, status: 'Pending' } });
        const myInProgressTasks = await prisma.task.count({ where: { assignedToId: userId, status: 'In Progress' } });
        const mySubmittedTasks = await prisma.task.count({ where: { assignedToId: userId, status: 'Submitted' } });
        const myApprovedTasks = await prisma.task.count({ where: { assignedToId: userId, status: 'Approved' } });
        const myRejectedTasks = await prisma.task.count({ where: { assignedToId: userId, status: 'Rejected' } });
        const myOverdueTasks = await prisma.task.count({
            where: { assignedToId: userId, deadline: { lt: new Date() }, status: { not: 'Approved' } }
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayReport = await prisma.dailyReport.findFirst({
            where: { userId, reportDate: { gte: today, lt: tomorrow } }
        });
        const todayReportStatus = todayReport ? todayReport.status : 'Missing';
        const latestManagerFeedback = todayReport?.managerFeedback || null;
        const myRecentTasks = await prisma.task.findMany({
            where: { assignedToId: userId },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        const myUpcomingDeadlines = await prisma.task.findMany({
            where: { assignedToId: userId, deadline: { gte: new Date() }, status: { not: 'Approved' } },
            orderBy: { deadline: 'asc' },
            take: 5
        });
        const myRejectedTasksWithFeedback = await prisma.taskSubmission.findMany({
            where: { userId, reviewStatus: 'Rejected' },
            include: { task: true },
            orderBy: { reviewedAt: 'desc' },
            take: 3
        });
        const myRecentDailyReports = await prisma.dailyReport.findMany({
            where: { userId },
            orderBy: { reportDate: 'desc' },
            take: 5
        });
        const myTaskCompletionRate = myTotalTasks > 0 ? ((myApprovedTasks / myTotalTasks) * 100).toFixed(1) : 0;
        // Calculate report submission rate (approximate since joined)
        const user = await prisma.user.findUnique({ where: { id: userId } });
        let myReportSubmissionRate = 0;
        if (user) {
            const daysSinceJoined = Math.max(1, Math.floor((new Date().getTime() - user.createdAt.getTime()) / (1000 * 3600 * 24)));
            const totalReports = await prisma.dailyReport.count({ where: { userId } });
            // assume 5 days a week work approx, let's just do total / days for simplicity
            myReportSubmissionRate = Math.min(100, (totalReports / (daysSinceJoined * (5 / 7))) * 100).toFixed(1);
        }
        res.json({
            myTotalTasks, myPendingTasks, myInProgressTasks, mySubmittedTasks, myApprovedTasks, myRejectedTasks, myOverdueTasks,
            todayReportStatus, latestManagerFeedback,
            myRecentTasks, myUpcomingDeadlines, myRejectedTasksWithFeedback, myRecentDailyReports,
            myTaskCompletionRate, myReportSubmissionRate
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error loading employee dashboard' });
    }
};
exports.getEmployeeDashboard = getEmployeeDashboard;
const getHrDashboard = async (req, res) => {
    try {
        const totalEmployees = await prisma.user.count();
        const activeEmployees = await prisma.user.count({ where: { isActive: true } });
        const inactiveEmployees = totalEmployees - activeEmployees;
        const departments = await prisma.department.findMany();
        const departmentWiseEmployees = await Promise.all(departments.map(async (dept) => ({
            name: dept.name,
            count: await prisma.user.count({ where: { departmentId: dept.id } })
        })));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const expectedSubmitters = await prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } });
        const todayReports = await prisma.dailyReport.count({ where: { reportDate: { gte: today, lt: tomorrow } } });
        const dailyReportCompliance = expectedSubmitters > 0 ? ((todayReports / expectedSubmitters) * 100).toFixed(1) : 0;
        const totalTasks = await prisma.task.count();
        const approvedTasks = await prisma.task.count({ where: { status: 'Approved' } });
        const taskCompletionOverview = totalTasks > 0 ? ((approvedTasks / totalTasks) * 100).toFixed(1) : 0;
        const recentReports = await prisma.dailyReport.findMany({
            include: { user: { select: { name: true } }, department: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        res.json({
            totalEmployees, activeEmployees, inactiveEmployees,
            departmentWiseEmployees, dailyReportCompliance, taskCompletionOverview, recentReports
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error loading HR dashboard' });
    }
};
exports.getHrDashboard = getHrDashboard;
