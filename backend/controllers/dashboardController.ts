import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { calculateMonthlyReportRate } from '../utils/reportUtils';
import prisma from '../prismaClient';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 30 }); // 30 seconds cache per spec §9

// Helper to calculate performance score
const calculatePerformanceScore = (approved: number, overdue: number, rejected: number, dailyReports: number) => {
  const score = (approved * 10) - (overdue * 5) - (rejected * 3) + (dailyReports * 2);
  return Math.max(0, score);
};

// Helper for date filtering
const getDateFilter = (startDate?: string, endDate?: string) => {
  if (startDate && endDate) {
    return {
      gte: new Date(startDate),
      lte: new Date(endDate + 'T23:59:59.999Z')
    };
  }
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return { gte: firstDay };
};

export const getAdminDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    const cacheKey = `admin_${startDate || ''}_${endDate || ''}_${department || ''}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const deptFilter: any = { deletedAt: null };
    const taskDeptFilter: any = { isDeleted: false, deletedAt: null };
    if (department) {
      deptFilter.department = { name: department as string };
      taskDeptFilter.department = { name: department as string };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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
      prisma.user.count({ where: { role: { not: 'SuperAdmin' }, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) } }),
      prisma.user.count({ where: { isActive: true, role: { not: 'SuperAdmin' }, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) } }),
      prisma.department.findUnique({ where: { name: 'Development' } }),
      prisma.department.findUnique({ where: { name: 'Media' } }),
      prisma.user.count({ where: { role: { in: ['Manager', 'SuperAdmin'] }, deletedAt: null } }),

      prisma.dailyReport.count({ where: { isDeleted: false, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) } }),
      prisma.dailyReport.count({ where: { isDeleted: false, deletedAt: null, reportDate: { gte: today, lt: tomorrow }, ...(department ? { department: { name: department as string } } : {}) } }),
      prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) } }),
      prisma.dailyReport.count({ where: { isDeleted: false, deletedAt: null, status: 'Needs Correction', ...(department ? { department: { name: department as string } } : {}) } }),
      prisma.dailyReport.count({ where: { isDeleted: false, deletedAt: null, status: 'Reviewed', ...(department ? { department: { name: department as string } } : {}) } }),

      // Tasks: strictly exclude soft-deleted tasks
      prisma.task.groupBy({ by: ['status'], where: taskDeptFilter, _count: { id: true } }),
      prisma.task.count({ where: { ...taskDeptFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      prisma.task.findMany({
        where: { ...taskDeptFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } },
        include: { assignedTo: { select: { name: true } }, department: { select: { name: true } } },
        take: 5
      }),

      prisma.taskSubmission.count({ where: { isDeleted: false, deletedAt: null, reviewStatus: 'Pending Review', task: taskDeptFilter } }),
      prisma.taskSubmission.findMany({
        where: { isDeleted: false, deletedAt: null, task: taskDeptFilter },
        include: { user: { select: { name: true } }, task: { select: { title: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 5
      }),
      prisma.dailyReport.findMany({
        where: { isDeleted: false, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) },
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
        where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) },
        include: { department: true }
      }),
      prisma.task.findMany({
        where: { ...taskDeptFilter, deadline: { gte: new Date() }, status: { not: 'Approved' } },
        orderBy: { deadline: 'asc' },
        take: 5,
        include: { assignedTo: { select: { name: true } } }
      }),

      prisma.task.groupBy({ by: ['departmentId', 'status'], where: { isDeleted: false, deletedAt: null }, _count: { id: true } }),
      prisma.task.groupBy({ by: ['departmentId'], where: { isDeleted: false, deletedAt: null, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['departmentId'], where: { isDeleted: false, deletedAt: null }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['departmentId'], where: { isDeleted: false, deletedAt: null, reportDate: { gte: today, lt: tomorrow } }, _count: { id: true } }),

      prisma.task.groupBy({ by: ['assignedToId', 'status'], where: { isDeleted: false, deletedAt: null }, _count: { id: true } }),
      prisma.task.groupBy({ by: ['assignedToId'], where: { isDeleted: false, deletedAt: null, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['userId'], where: { isDeleted: false, deletedAt: null }, _count: { id: true } })
    ]);

    const totalTasks = taskStatusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
    const pendingTasks = taskStatusCounts.find(s => s.status === 'Pending')?._count.id || 0;
    const inProgressTasks = taskStatusCounts.find(s => s.status === 'In Progress')?._count.id || 0;
    const submittedTasks = taskStatusCounts.find(s => s.status === 'Submitted')?._count.id || 0;
    const approvedTasks = taskStatusCounts.find(s => s.status === 'Approved')?._count.id || 0;
    const rejectedTasks = taskStatusCounts.find(s => s.status === 'Rejected')?._count.id || 0;

    const inactiveEmployees = totalEmployees - activeEmployees;

    const [developmentTeamCount, mediaTeamCount] = await Promise.all([
      devDept ? prisma.user.count({ where: { departmentId: devDept.id, deletedAt: null } }) : Promise.resolve(0),
      mediaDept ? prisma.user.count({ where: { departmentId: mediaDept.id, deletedAt: null } }) : Promise.resolve(0)
    ]);

    const missingReportsToday = Math.max(0, expectedSubmitters - todayReports);

    const recentActivityLogs = realActivityLogs.map(log => {
      let msg = log.description || '';
      if (log.user && log.user.name) {
        if (msg.startsWith('User ')) {
          msg = msg.replace(/^User /, `${log.user.name} `);
        } else {
          msg = `${log.user.name} ${msg.charAt(0).toLowerCase() + msg.slice(1)}`;
        }
      }
      return {
        type: log.action,
        message: msg,
        date: log.createdAt
      };
    });

    const departmentWiseTaskStats = departments.map(dept => {
      const stats = departmentWiseTaskStatsRaw.filter(g => g.departmentId === dept.id);
      const overdueStats = departmentWiseOverdueRaw.find(g => g.departmentId === dept.id);
      const total = stats.reduce((sum, g) => sum + g._count.id, 0);
      const approved = stats.find(g => g.status === 'Approved')?._count.id || 0;
      return {
        departmentName: dept.name,
        totalTasks: total,
        completedTasks: approved,
        overdueTasks: overdueStats?._count.id || 0
      };
    });

    const departmentWiseReportStats = departments.map(dept => {
      const totalReports = departmentWiseReportStatsRaw.find(g => g.departmentId === dept.id)?._count.id || 0;
      const todayCount = departmentWiseReportTodayRaw.find(g => g.departmentId === dept.id)?._count.id || 0;
      return {
        departmentName: dept.name,
        totalReports,
        todayReports: todayCount
      };
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
        department: emp.department?.name || 'Unassigned',
        totalTasks: empTotalTasks,
        completedTasks: empApprovedTasks,
        overdueTasks: empOverdueTasks,
        dailyReportsCount: empDailyReports,
        performanceScore: calculatePerformanceScore(empApprovedTasks, empOverdueTasks, empRejectedTasks, empDailyReports)
      };
    });

    const leaderboard = [...employeePerformanceSummary].sort((a, b) => b.performanceScore - a.performanceScore);

    const responseData = {
      totalEmployees, activeEmployees, inactiveEmployees,
      developmentTeamCount, mediaTeamCount, managementCount,
      totalDailyReports, todayReports, expectedSubmitters, missingReportsToday,
      reportsNeedingCorrection, reviewedReports,
      totalTasks, pendingTasks, inProgressTasks, submittedTasks, approvedTasks, rejectedTasks,
      overdueTasksCount, overdueTaskList,
      pendingReviewSubmissions,
      recentTaskSubmissions, recentDailyReports, recentActivityLogs,
      upcomingDeadlines,
      departmentWiseTaskStats, departmentWiseReportStats,
      employeePerformanceSummary, leaderboard
    };

    cache.set(cacheKey, responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ message: 'Error loading admin dashboard' });
  }
};

export const getManagerDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, department } = req.query;
    const cacheKey = `manager_${startDate || ''}_${endDate || ''}_${department || ''}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const deptFilter: any = { isDeleted: false, deletedAt: null };
    if (department) {
      deptFilter.department = { name: department as string };
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      teamEmployees, activeTeamEmployees, todayTeamReports, expectedSubmitters,
      reportsNeedingCorrection, employees,
      taskStatusCounts, overdueTeamTasks, overdueTeamTaskList,
      pendingReviewSubmissions, recentTeamSubmissions, recentTeamReports, realActivityLogs,
      upcomingTeamDeadlines,
      teamTaskGroups, teamOverdueGroups, teamReportGroups
    ] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) } }),
      prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) } }),
      
      prisma.dailyReport.count({ where: { ...deptFilter, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) } }),
      prisma.dailyReport.count({ where: { ...deptFilter, status: 'Needs Correction' } }),
      prisma.user.findMany({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, deletedAt: null, ...(department ? { department: { name: department as string } } : {}) }, include: { department: true } }),

      prisma.task.groupBy({ by: ['status'], where: deptFilter, _count: { id: true } }),
      prisma.task.count({ where: { ...deptFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      prisma.task.findMany({
        where: { ...deptFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } },
        include: { assignedTo: { select: { name: true } } },
        take: 5
      }),

      prisma.taskSubmission.count({ where: { isDeleted: false, deletedAt: null, reviewStatus: 'Pending Review', task: deptFilter } }),
      prisma.taskSubmission.findMany({
        where: { isDeleted: false, deletedAt: null, task: deptFilter },
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

      prisma.task.groupBy({ by: ['assignedToId', 'status'], where: { isDeleted: false, deletedAt: null }, _count: { id: true } }),
      prisma.task.groupBy({ by: ['assignedToId'], where: { isDeleted: false, deletedAt: null, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['userId'], where: { isDeleted: false, deletedAt: null }, _count: { id: true } })
    ]);

    const totalTeamTasks = taskStatusCounts.reduce((acc, curr) => acc + curr._count.id, 0);
    const pendingTeamTasks = taskStatusCounts.find(s => s.status === 'Pending')?._count.id || 0;
    const inProgressTeamTasks = taskStatusCounts.find(s => s.status === 'In Progress')?._count.id || 0;
    const submittedTeamTasks = taskStatusCounts.find(s => s.status === 'Submitted')?._count.id || 0;
    const approvedTeamTasks = taskStatusCounts.find(s => s.status === 'Approved')?._count.id || 0;
    const rejectedTeamTasks = taskStatusCounts.find(s => s.status === 'Rejected')?._count.id || 0;

    const inactiveTeamEmployees = teamEmployees - activeTeamEmployees;
    const missingTeamReportsToday = Math.max(0, expectedSubmitters - todayTeamReports);

    const recentActivityLogs = realActivityLogs.map(log => {
      let msg = log.description || '';
      if (log.user && log.user.name) {
        if (msg.startsWith('User ')) {
          msg = msg.replace(/^User /, `${log.user.name} `);
        } else {
          msg = `${log.user.name} ${msg.charAt(0).toLowerCase() + msg.slice(1)}`;
        }
      }
      return {
        type: log.action,
        message: msg,
        date: log.createdAt
      };
    });

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
        department: emp.department?.name || 'Unassigned',
        totalTasks: empTotalTasks,
        completedTasks: empApprovedTasks,
        overdueTasks: empOverdueTasks,
        dailyReportsCount: empDailyReports,
        performanceScore: calculatePerformanceScore(empApprovedTasks, empOverdueTasks, empRejectedTasks, empDailyReports)
      };
    });

    const leaderboard = [...teamPerformanceSummary].sort((a, b) => b.performanceScore - a.performanceScore);

    const responseData = {
      teamEmployees, activeTeamEmployees, inactiveTeamEmployees,
      todayTeamReports, expectedSubmitters, missingTeamReportsToday, reportsNeedingCorrection,
      totalTeamTasks, pendingTeamTasks, inProgressTeamTasks, submittedTeamTasks, approvedTeamTasks, rejectedTeamTasks,
      overdueTeamTasks, overdueTeamTaskList,
      pendingReviewSubmissions,
      recentTeamSubmissions, recentTeamReports, recentActivityLogs,
      upcomingTeamDeadlines,
      teamPerformanceSummary, leaderboard
    };

    cache.set(cacheKey, responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Manager Dashboard Error:', error);
    res.status(500).json({ message: 'Error loading manager dashboard' });
  }
};

export const getEmployeeDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const cacheKey = `employee_${userId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const taskStatusCounts = await prisma.task.groupBy({
      by: ['status'],
      where: { assignedToId: userId, isDeleted: false, deletedAt: null },
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
      prisma.task.count({ where: { assignedToId: userId, isDeleted: false, deletedAt: null, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      
      prisma.dailyReport.findFirst({ where: { userId, isDeleted: false, deletedAt: null, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.task.findMany({ where: { assignedToId: userId, isDeleted: false, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.task.findMany({ where: { assignedToId: userId, isDeleted: false, deletedAt: null, deadline: { gte: new Date() }, status: { not: 'Approved' } }, orderBy: { deadline: 'asc' }, take: 5 }),
      prisma.taskSubmission.findMany({ where: { userId, isDeleted: false, deletedAt: null, reviewStatus: 'Rejected' }, include: { task: true }, orderBy: { reviewedAt: 'desc' }, take: 3 }),
      prisma.dailyReport.findMany({ where: { userId, isDeleted: false, deletedAt: null }, orderBy: { reportDate: 'desc' }, take: 5 }),
      prisma.user.findUnique({ where: { id: userId } })
    ]);

    const todayReportStatus = todayReport ? todayReport.status : 'Missing';
    const latestManagerFeedback = todayReport?.managerFeedback || null;
    const myTaskCompletionRate = myTotalTasks > 0 ? ((myApprovedTasks / myTotalTasks) * 100).toFixed(1) : 0;
    
    let myReportSubmissionRate = 0;
    if (user) {
      myReportSubmissionRate = Number(await calculateMonthlyReportRate(userId));
    }

    const responseData = {
      myTotalTasks, myPendingTasks, myInProgressTasks, mySubmittedTasks, myApprovedTasks, myRejectedTasks, myOverdueTasks,
      todayReportStatus, latestManagerFeedback,
      myRecentTasks, myUpcomingDeadlines, myRejectedTasksWithFeedback, myRecentDailyReports,
      myTaskCompletionRate, myReportSubmissionRate
    };

    cache.set(cacheKey, responseData);
    res.json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading employee dashboard' });
  }
};

export const getHrDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const cacheKey = `hr_dashboard`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalEmployees, activeEmployees, departments, expectedSubmitters, todayReports, totalTasks, approvedTasks, recentReports
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      prisma.department.findMany(),
      prisma.user.count({ where: { role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true, deletedAt: null } }),
      prisma.dailyReport.count({ where: { isDeleted: false, deletedAt: null, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.task.count({ where: { isDeleted: false, deletedAt: null } }),
      prisma.task.count({ where: { isDeleted: false, deletedAt: null, status: 'Approved' } }),
      prisma.dailyReport.findMany({
        where: { isDeleted: false, deletedAt: null },
        include: { user: { select: { name: true } }, department: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    const missingReports = Math.max(0, expectedSubmitters - todayReports);

    const responseData = {
      totalEmployees,
      activeEmployees,
      inactiveEmployees: totalEmployees - activeEmployees,
      departmentCount: departments.length,
      expectedSubmitters,
      todayReports,
      missingReports,
      totalTasks,
      approvedTasks,
      taskCompletionRate: totalTasks > 0 ? ((approvedTasks / totalTasks) * 100).toFixed(1) : 0,
      recentReports
    };

    cache.set(cacheKey, responseData);
    res.json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading HR dashboard' });
  }
};
