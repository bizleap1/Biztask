import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { calculateMonthlyReportRate } from '../utils/reportUtils';

import prisma from '../prismaClient';

// Helper to calculate performance score
const calculatePerformanceScore = (approved: number, overdue: number, rejected: number, dailyReports: number) => {
  // Simple formula as requested
  const score = (approved * 10) - (overdue * 5) - (rejected * 3) + (dailyReports * 2);
  return Math.max(0, score); // Prevent negative score
};

// Helper for date filtering
const getDateFilter = (startDate?: string, endDate?: string) => {
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

export const getAdminDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    // Filters
    const dateFilter = getDateFilter(startDate as string, endDate as string);
    const deptFilter = department ? { department: { name: department as string } } : {};
    const taskDeptFilter = department ? { department: { name: department as string } } : {};

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasksQuery = { where: { ...taskDeptFilter } };

    const [
      departments, totalEmployees, activeEmployees, devDept, mediaDept, managementCount,
      totalDailyReports, todayReports, expectedSubmitters, reportsNeedingCorrection, reviewedReports,
      taskStatusCounts, overdueTasksCount, overdueTaskList,
      pendingReviewSubmissions, recentTaskSubmissions, recentDailyReports, realActivityLogs,
      employees, upcomingDeadlines,
      departmentWiseTaskStatsRaw, departmentWiseOverdueRaw,
      departmentWiseReportStatsRaw, departmentWiseReportTodayRaw,
      taskGroups, overdueGroups, reportGroups
    ] = await Promise.all([
      prisma.department.findMany(),
      prisma.user.count({ where: { ...deptFilter } }),
      prisma.user.count({ where: { isActive: true, ...deptFilter } }),
      prisma.department.findUnique({ where: { name: 'Development' } }),
      prisma.department.findUnique({ where: { name: 'Media' } }),
      prisma.user.count({ where: { role: { in: ['Manager', 'SuperAdmin'] } } }),

      prisma.dailyReport.count({ where: { ...deptFilter } }),
      prisma.dailyReport.count({ where: { ...deptFilter, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.user.count({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
      prisma.dailyReport.count({ where: { ...deptFilter, status: 'Needs Correction' } }),
      prisma.dailyReport.count({ where: { ...deptFilter, status: 'Reviewed' } }),

      prisma.task.groupBy({ by: ['status'], where: tasksQuery.where, _count: { id: true } }),
      prisma.task.count({ where: { ...tasksQuery.where, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      prisma.task.findMany({
        where: { ...tasksQuery.where, deadline: { lt: new Date() }, status: { not: 'Approved' } },
        include: { assignedTo: { select: { name: true } }, department: { select: { name: true } } },
        take: 5
      }),

      prisma.taskSubmission.count({ where: { reviewStatus: 'Pending Review', task: taskDeptFilter } }),
      prisma.taskSubmission.findMany({
        where: { task: taskDeptFilter },
        include: { user: { select: { name: true } }, task: { select: { title: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 5
      }),
      prisma.dailyReport.findMany({
        where: { ...deptFilter },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.activityLog.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8
      }),
      
      prisma.user.findMany({
        where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, ...deptFilter },
        include: { department: true }
      }),
      prisma.task.findMany({
        where: { ...tasksQuery.where, deadline: { gte: new Date() }, status: { not: 'Approved' } },
        orderBy: { deadline: 'asc' },
        take: 5,
        include: { assignedTo: { select: { name: true } } }
      }),

      prisma.task.groupBy({ by: ['departmentId', 'status'], _count: { id: true } }),
      prisma.task.groupBy({ by: ['departmentId'], where: { deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['departmentId'], _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['departmentId'], where: { reportDate: { gte: today, lt: tomorrow } }, _count: { id: true } }),

      prisma.task.groupBy({ by: ['assignedToId', 'status'], _count: { id: true } }),
      prisma.task.groupBy({ by: ['assignedToId'], where: { deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['userId'], _count: { id: true } })
    ]);

    const totalTasks = taskStatusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
    const pendingTasks = taskStatusCounts.find(s => s.status === 'Pending')?._count.id || 0;
    const inProgressTasks = taskStatusCounts.find(s => s.status === 'In Progress')?._count.id || 0;
    const submittedTasks = taskStatusCounts.find(s => s.status === 'Submitted')?._count.id || 0;
    const approvedTasks = taskStatusCounts.find(s => s.status === 'Approved')?._count.id || 0;
    const rejectedTasks = taskStatusCounts.find(s => s.status === 'Rejected')?._count.id || 0;

    const inactiveEmployees = totalEmployees - activeEmployees;

    // Fast follow-up queries
    const [developmentTeamCount, mediaTeamCount] = await Promise.all([
      devDept ? prisma.user.count({ where: { departmentId: devDept.id } }) : Promise.resolve(0),
      mediaDept ? prisma.user.count({ where: { departmentId: mediaDept.id } }) : Promise.resolve(0)
    ]);

    const missingReportsToday = Math.max(0, expectedSubmitters - todayReports);

    const recentActivityLogs = realActivityLogs.map(log => ({
      type: log.action,
      message: log.description,
      date: log.createdAt
    }));

    const departmentWiseTaskStats = departments.map(dept => {
      const stats = departmentWiseTaskStatsRaw.filter(g => g.departmentId === dept.id);
      const overdueStats = departmentWiseOverdueRaw.find(g => g.departmentId === dept.id);
      const total = stats.reduce((sum, g) => sum + g._count.id, 0);
      const approved = stats.find(g => g.status === 'Approved')?._count.id || 0;
      const overdue = overdueStats?._count.id || 0;
      return { name: dept.name, total, approved, overdue };
    });

    const departmentWiseReportStats = departments.map(dept => {
      const total = departmentWiseReportStatsRaw.find(g => g.departmentId === dept.id)?._count.id || 0;
      const todayCount = departmentWiseReportTodayRaw.find(g => g.departmentId === dept.id)?._count.id || 0;
      return { name: dept.name, total, today: todayCount };
    });

    const employeePerformanceSummary = employees.map(emp => {
      const empTaskGroups = taskGroups.filter(g => g.assignedToId === emp.id);
      const empTotalTasks = empTaskGroups.reduce((sum, g) => sum + g._count.id, 0);
      const empApprovedTasks = empTaskGroups.find(g => g.status === 'Approved')?._count.id || 0;
      const empRejectedTasks = empTaskGroups.find(g => g.status === 'Rejected')?._count.id || 0;
      const empOverdueTasks = overdueGroups.find(g => g.assignedToId === emp.id)?._count.id || 0;
      const empDailyReports = reportGroups.find(g => g.userId === emp.id)?._count.id || 0;

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
    });

    res.json({
      totalEmployees, activeEmployees, inactiveEmployees,
      developmentTeamCount, mediaTeamCount, managementCount,
      totalTasks, pendingTasks, inProgressTasks, submittedTasks, approvedTasks, rejectedTasks, overdueTasks: overdueTasksCount,
      totalDailyReports, todayReports, missingReportsToday, reportsNeedingCorrection, reviewedReports,
      pendingReviewSubmissions, recentTaskSubmissions, recentDailyReports, recentActivityLogs,
      departmentWiseTaskStats, departmentWiseReportStats, employeePerformanceSummary, upcomingDeadlines, overdueTaskList
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading admin dashboard' });
  }
};

export const getManagerDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = getDateFilter(startDate as string, endDate as string);
    const deptFilter = {};

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      teamEmployees, activeTeamEmployees,
      todayTeamReports, expectedSubmitters, reportsNeedingCorrection,
      employees,
      taskStatusCounts,
      overdueTeamTasks, overdueTeamTaskList,
      pendingReviewSubmissions, recentTeamSubmissions, recentTeamReports, realActivityLogs,
      upcomingTeamDeadlines,
      teamTaskGroups, teamOverdueGroups, teamReportGroups
    ] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] } } }),
      prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
      
      prisma.dailyReport.count({ where: { ...deptFilter, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.user.count({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
      prisma.dailyReport.count({ where: { ...deptFilter, status: 'Needs Correction' } }),
      prisma.user.findMany({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] } } }),

      prisma.task.groupBy({ by: ['status'], where: deptFilter, _count: { id: true } }),

      prisma.task.count({ where: { ...deptFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      prisma.task.findMany({
        where: { ...deptFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } },
        include: { assignedTo: { select: { name: true } } },
        take: 5
      }),

      prisma.taskSubmission.count({ where: { task: deptFilter, reviewStatus: 'Pending Review' } }),
      prisma.taskSubmission.findMany({
        where: { task: deptFilter },
        include: { user: { select: { name: true } }, task: { select: { title: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 5
      }),
      prisma.dailyReport.findMany({
        where: deptFilter,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.activityLog.findMany({
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8
      }),
      
      prisma.task.findMany({
        where: { ...deptFilter, deadline: { gte: new Date() }, status: { not: 'Approved' } },
        orderBy: { deadline: 'asc' },
        take: 5,
        include: { assignedTo: { select: { name: true } } }
      }),

      prisma.task.groupBy({ by: ['assignedToId', 'status'], _count: { id: true } }),
      prisma.task.groupBy({ by: ['assignedToId'], where: { deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['userId'], _count: { id: true } })
    ]);

    const totalTeamTasks = taskStatusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
    const pendingTeamTasks = taskStatusCounts.find(s => s.status === 'Pending')?._count.id || 0;
    const inProgressTeamTasks = taskStatusCounts.find(s => s.status === 'In Progress')?._count.id || 0;
    const submittedTeamTasks = taskStatusCounts.find(s => s.status === 'Submitted')?._count.id || 0;
    const approvedTeamTasks = taskStatusCounts.find(s => s.status === 'Approved')?._count.id || 0;
    const rejectedTeamTasks = taskStatusCounts.find(s => s.status === 'Rejected')?._count.id || 0;

    const inactiveTeamEmployees = teamEmployees - activeTeamEmployees;
    const missingTeamReportsToday = Math.max(0, expectedSubmitters - todayTeamReports);

    const recentActivityLogs = realActivityLogs.map(log => ({
      type: log.action,
      message: log.description,
      date: log.createdAt
    }));

    const teamPerformanceSummary = employees.map(emp => {
      const empTaskGroups = teamTaskGroups.filter(g => g.assignedToId === emp.id);
      const empTotalTasks = empTaskGroups.reduce((sum, g) => sum + g._count.id, 0);
      const empApprovedTasks = empTaskGroups.find(g => g.status === 'Approved')?._count.id || 0;
      const empRejectedTasks = empTaskGroups.find(g => g.status === 'Rejected')?._count.id || 0;
      const empOverdueTasks = teamOverdueGroups.find(g => g.assignedToId === emp.id)?._count.id || 0;
      const empDailyReports = teamReportGroups.find(g => g.userId === emp.id)?._count.id || 0;

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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading manager dashboard' });
  }
};

export const getEmployeeDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const taskStatusCounts = await prisma.task.groupBy({
      by: ['status'],
      where: { assignedToId: userId },
      _count: { id: true }
    });

    const myTotalTasks = taskStatusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
    const myPendingTasks = taskStatusCounts.find(s => s.status === 'Pending')?._count.id || 0;
    const myInProgressTasks = taskStatusCounts.find(s => s.status === 'In Progress')?._count.id || 0;
    const mySubmittedTasks = taskStatusCounts.find(s => s.status === 'Submitted')?._count.id || 0;
    const myApprovedTasks = taskStatusCounts.find(s => s.status === 'Approved')?._count.id || 0;
    const myRejectedTasks = taskStatusCounts.find(s => s.status === 'Rejected')?._count.id || 0;

    const [
      myOverdueTasks,
      todayReport, myRecentTasks, myUpcomingDeadlines, myRejectedTasksWithFeedback, myRecentDailyReports, user
    ] = await Promise.all([
      prisma.task.count({ where: { assignedToId: userId, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      
      prisma.dailyReport.findFirst({ where: { userId, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.task.findMany({ where: { assignedToId: userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.task.findMany({ where: { assignedToId: userId, deadline: { gte: new Date() }, status: { not: 'Approved' } }, orderBy: { deadline: 'asc' }, take: 5 }),
      prisma.taskSubmission.findMany({ where: { userId, reviewStatus: 'Rejected' }, include: { task: true }, orderBy: { reviewedAt: 'desc' }, take: 3 }),
      prisma.dailyReport.findMany({ where: { userId }, orderBy: { reportDate: 'desc' }, take: 5 }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    const todayReportStatus = todayReport ? todayReport.status : 'Missing';
    const latestManagerFeedback = todayReport?.managerFeedback || null;
    const myTaskCompletionRate = myTotalTasks > 0 ? ((myApprovedTasks / myTotalTasks) * 100).toFixed(1) : 0;
    
    let myReportSubmissionRate = 0;
    if (user) {
      myReportSubmissionRate = Number(await calculateMonthlyReportRate(userId));
    }

    res.json({
      myTotalTasks, myPendingTasks, myInProgressTasks, mySubmittedTasks, myApprovedTasks, myRejectedTasks, myOverdueTasks,
      todayReportStatus, latestManagerFeedback,
      myRecentTasks, myUpcomingDeadlines, myRejectedTasksWithFeedback, myRecentDailyReports,
      myTaskCompletionRate, myReportSubmissionRate
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading employee dashboard' });
  }
};

export const getHrDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalEmployees, activeEmployees, departments, expectedSubmitters, todayReports, totalTasks, approvedTasks, recentReports
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.department.findMany(),
      prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
      prisma.dailyReport.count({ where: { reportDate: { gte: today, lt: tomorrow } } }),
      prisma.task.count(),
      prisma.task.count({ where: { status: 'Approved' } }),
      prisma.dailyReport.findMany({
        include: { user: { select: { name: true } }, department: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    const inactiveEmployees = totalEmployees - activeEmployees;

    const departmentUserCountsRaw = await prisma.user.groupBy({
      by: ['departmentId'],
      _count: { id: true }
    });

    const departmentWiseEmployees = departments.map(dept => ({
      name: dept.name,
      count: departmentUserCountsRaw.find(g => g.departmentId === dept.id)?._count.id || 0
    }));

    const dailyReportCompliance = expectedSubmitters > 0 ? ((todayReports / expectedSubmitters) * 100).toFixed(1) : 0;
    const taskCompletionOverview = totalTasks > 0 ? ((approvedTasks / totalTasks) * 100).toFixed(1) : 0;

    res.json({
      totalEmployees, activeEmployees, inactiveEmployees,
      departmentWiseEmployees, dailyReportCompliance, taskCompletionOverview, recentReports
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading HR dashboard' });
  }
};
