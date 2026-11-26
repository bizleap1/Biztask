
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { calculateMonthlyReportRate } from '../utils/reportUtils';

import prisma from '../prismaClient';
interface StatusCountGroup {
  status: string;
  _count: { id: number };
}

interface DeptCountGroup {
  departmentId: number | null;
  status?: string;
  _count: { id: number };
}

interface UserCountGroup {
  assignedToId?: number | null;
  userId?: number;
  status?: string;
  _count: { id: number };
}

interface ActivityLogItem {
  description: string | null;
  action: string;
  createdAt: Date;
  user?: { name: string } | null;
}

interface DeptItem {
  id: number;
  name: string;
}

interface EmployeeItem {
  id: number;
  name: string;
  department?: { name: string } | null;
}

// Helper to calculate performance score
export const calculatePerformanceScore = (
  approved: number,
  overdue: number,
  rejected: number,
  totalTasks: number,
  attendanceRate: number = 100
) => {
  const safeTotal = Math.max(0, totalTasks);
  const onTime = Math.max(0, approved - overdue);
  const onTimeRate = safeTotal > 0 ? onTime / safeTotal : 0;
  const completionRate = safeTotal > 0 ? approved / safeTotal : 0;
  const reworkPenalty = safeTotal > 0 ? rejected / safeTotal : 0;
  const attendance = Math.max(0, Math.min(100, attendanceRate)) / 100;
  const score = (onTimeRate * 40) + (completionRate * 30) + (attendance * 30) - (reworkPenalty * 10);
  return Math.round(Math.max(0, Math.min(100, score)));
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
    const hasExplicitDates = Boolean(startDate && endDate);
    const dateFilter = getDateFilter(startDate as string, endDate as string);
    const createdAtFilter = hasExplicitDates ? { createdAt: dateFilter } : {};
    const reportDateFilter = hasExplicitDates ? { reportDate: dateFilter } : {};
    const deptFilter = department ? { department: { name: department as string } } : {};
    const taskDeptFilter = department ? { department: { name: department as string } } : {};

    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasksQuery = { where: { isDeleted: false, ...taskDeptFilter, ...createdAtFilter } };

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
      prisma.user.count({ where: { role: { not: 'SuperAdmin' }, ...deptFilter } }),
      prisma.user.count({ where: { isActive: true, role: { not: 'SuperAdmin' }, ...deptFilter } }),
      prisma.department.findUnique({ where: { name: 'Development' } }),
      prisma.department.findUnique({ where: { name: 'Media' } }),
      prisma.user.count({ where: { role: { in: ['Manager', 'SuperAdmin'] } } }),

      prisma.dailyReport.count({ where: { isDeleted: false, ...deptFilter, ...reportDateFilter } }),
      prisma.dailyReport.count({ where: { isDeleted: false, ...deptFilter, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.user.count({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
      prisma.dailyReport.count({ where: { isDeleted: false, ...deptFilter, ...reportDateFilter, status: 'Needs Correction' } }),
      prisma.dailyReport.count({ where: { isDeleted: false, ...deptFilter, ...reportDateFilter, status: 'Reviewed' } }),

      prisma.task.groupBy({ by: ['status'], where: tasksQuery.where, _count: { id: true } }),
      prisma.task.count({ where: { ...tasksQuery.where, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      prisma.task.findMany({
        where: { ...tasksQuery.where, deadline: { lt: new Date() }, status: { not: 'Approved' } },
        include: { assignedTo: { select: { name: true } }, department: { select: { name: true } } },
        take: 5
      }),

      prisma.taskSubmission.count({ where: { isDeleted: false, reviewStatus: 'Pending Review', task: { isDeleted: false, ...taskDeptFilter } } }),
      prisma.taskSubmission.findMany({
        where: { isDeleted: false, task: { isDeleted: false, ...taskDeptFilter } },
        include: { user: { select: { name: true } }, task: { select: { title: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 5
      }),
      prisma.dailyReport.findMany({
        where: { isDeleted: false, ...deptFilter, ...reportDateFilter },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.activityLog.findMany({
        where: { isDeleted: false },
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

      prisma.task.groupBy({ by: ['departmentId', 'status'], where: { isDeleted: false, ...createdAtFilter }, _count: { id: true } }),
      prisma.task.groupBy({ by: ['departmentId'], where: { isDeleted: false, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['departmentId'], where: { isDeleted: false, ...reportDateFilter }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['departmentId'], where: { isDeleted: false, reportDate: { gte: today, lt: tomorrow } }, _count: { id: true } }),

      prisma.task.groupBy({ by: ['assignedToId', 'status'], where: { isDeleted: false, ...createdAtFilter }, _count: { id: true } }),
      prisma.task.groupBy({ by: ['assignedToId'], where: { isDeleted: false, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['userId'], where: { isDeleted: false, ...reportDateFilter }, _count: { id: true } })
    ]);

    const totalTasks = taskStatusCounts.reduce((acc: number, curr: StatusCountGroup) => acc + curr._count.id, 0);
    const pendingTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Pending')?._count.id || 0;
    const inProgressTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'In Progress')?._count.id || 0;
    const submittedTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Submitted')?._count.id || 0;
    const approvedTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Approved')?._count.id || 0;
    const rejectedTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Rejected')?._count.id || 0;

    const inactiveEmployees = totalEmployees - activeEmployees;

    // Fast follow-up queries
    const [developmentTeamCount, mediaTeamCount] = await Promise.all([
      devDept ? prisma.user.count({ where: { departmentId: devDept.id } }) : Promise.resolve(0),
      mediaDept ? prisma.user.count({ where: { departmentId: mediaDept.id } }) : Promise.resolve(0)
    ]);

    const missingReportsToday = Math.max(0, expectedSubmitters - todayReports);

    const recentActivityLogs = realActivityLogs.map((log: ActivityLogItem) => {
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

    const departmentWiseTaskStats = departments.map((dept: DeptItem) => {
      const stats = departmentWiseTaskStatsRaw.filter((g: DeptCountGroup) => g.departmentId === dept.id);
      const overdueStats = departmentWiseOverdueRaw.find((g: DeptCountGroup) => g.departmentId === dept.id);
      const total = stats.reduce((sum: number, g: DeptCountGroup) => sum + g._count.id, 0);
      const approved = stats.find((g: DeptCountGroup) => g.status === 'Approved')?._count.id || 0;
      const overdue = overdueStats?._count.id || 0;
      return { name: dept.name, total, approved, overdue };
    });

    const departmentWiseReportStats = departments.map((dept: DeptItem) => {
      const total = departmentWiseReportStatsRaw.find((g: DeptCountGroup) => g.departmentId === dept.id)?._count.id || 0;
      const todayCount = departmentWiseReportTodayRaw.find((g: DeptCountGroup) => g.departmentId === dept.id)?._count.id || 0;
      return { name: dept.name, total, today: todayCount };
    });

    const employeePerformanceSummary = employees.map((emp: EmployeeItem) => {
      const empTaskGroups = taskGroups.filter((g: UserCountGroup) => g.assignedToId === emp.id);
      const empTotalTasks = empTaskGroups.reduce((sum: number, g: UserCountGroup) => sum + g._count.id, 0);
      const empApprovedTasks = empTaskGroups.find((g: UserCountGroup) => g.status === 'Approved')?._count.id || 0;
      const empRejectedTasks = empTaskGroups.find((g: UserCountGroup) => g.status === 'Rejected')?._count.id || 0;
      const empOverdueTasks = overdueGroups.find((g: UserCountGroup) => g.assignedToId === emp.id)?._count.id || 0;
      const empDailyReports = reportGroups.find((g: UserCountGroup) => g.userId === emp.id)?._count.id || 0;

      return {
        id: emp.id,
        name: emp.name,
        department: emp.department?.name || 'N/A',
        totalTasks: empTotalTasks,
        approved: empApprovedTasks,
        rejected: empRejectedTasks,
        overdue: empOverdueTasks,
        reportsSubmitted: empDailyReports,
        score: calculatePerformanceScore(empApprovedTasks, empOverdueTasks, empRejectedTasks, empTotalTasks, 100)
      };
    });

    const [atRiskSetting, atRiskClientsRaw] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'client_at_risk_overdue_threshold' } }),
      prisma.client.findMany({
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
      .map((client: any) => ({
        id: client.id,
        name: client.name,
        status: client.status,
        overdueTaskCount: client.tasks.length,
        overdueTasks: client.tasks
      }))
      .filter((client: any) => client.status === 'At-Risk' || client.overdueTaskCount >= atRiskThreshold);

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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading admin dashboard' });
  }
};

export const getManagerDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const hasExplicitDates = Boolean(startDate && endDate);
    const dateFilter = getDateFilter(startDate as string, endDate as string);
    const createdAtFilter = hasExplicitDates ? { createdAt: dateFilter } : {};
    const reportDateFilter = hasExplicitDates ? { reportDate: dateFilter } : {};
    const deptFilter = req.user?.departmentId ? { departmentId: req.user.departmentId } : {};

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
      
      prisma.dailyReport.count({ where: { isDeleted: false, ...deptFilter, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.user.count({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] }, isActive: true } }),
      prisma.dailyReport.count({ where: { isDeleted: false, ...deptFilter, ...reportDateFilter, status: 'Needs Correction' } }),
      prisma.user.findMany({ where: { ...deptFilter, role: { in: ['DevEmployee', 'MediaEmployee'] } } }),

      prisma.task.groupBy({ by: ['status'], where: { isDeleted: false, ...deptFilter, ...createdAtFilter }, _count: { id: true } }),

      prisma.task.count({ where: { isDeleted: false, ...deptFilter, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      prisma.task.findMany({
        where: { isDeleted: false, ...deptFilter, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } },
        include: { assignedTo: { select: { name: true } } },
        take: 5
      }),

      prisma.taskSubmission.count({ where: { isDeleted: false, task: { isDeleted: false, ...deptFilter }, reviewStatus: 'Pending Review' } }),
      prisma.taskSubmission.findMany({
        where: { isDeleted: false, task: { isDeleted: false, ...deptFilter } },
        include: { user: { select: { name: true } }, task: { select: { title: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 5
      }),
      prisma.dailyReport.findMany({
        where: { isDeleted: false, ...deptFilter, ...reportDateFilter },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.activityLog.findMany({
        where: { isDeleted: false },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8
      }),
      
      prisma.task.findMany({
        where: { isDeleted: false, ...deptFilter, ...createdAtFilter, deadline: { gte: new Date() }, status: { not: 'Approved' } },
        orderBy: { deadline: 'asc' },
        take: 5,
        include: { assignedTo: { select: { name: true } } }
      }),

      prisma.task.groupBy({ by: ['assignedToId', 'status'], where: { isDeleted: false, ...createdAtFilter }, _count: { id: true } }),
      prisma.task.groupBy({ by: ['assignedToId'], where: { isDeleted: false, ...createdAtFilter, deadline: { lt: new Date() }, status: { not: 'Approved' } }, _count: { id: true } }),
      prisma.dailyReport.groupBy({ by: ['userId'], where: { isDeleted: false, ...reportDateFilter }, _count: { id: true } })
    ]);

    const totalTeamTasks = taskStatusCounts.reduce((acc: number, curr: StatusCountGroup) => acc + curr._count.id, 0);
    const pendingTeamTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Pending')?._count.id || 0;
    const inProgressTeamTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'In Progress')?._count.id || 0;
    const submittedTeamTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Submitted')?._count.id || 0;
    const approvedTeamTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Approved')?._count.id || 0;
    const rejectedTeamTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Rejected')?._count.id || 0;

    const inactiveTeamEmployees = teamEmployees - activeTeamEmployees;
    const missingTeamReportsToday = Math.max(0, expectedSubmitters - todayTeamReports);

    const recentActivityLogs = realActivityLogs.map((log: ActivityLogItem) => {
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

    const teamPerformanceSummary = employees.map((emp: EmployeeItem) => {
      const empTaskGroups = teamTaskGroups.filter((g: UserCountGroup) => g.assignedToId === emp.id);
      const empTotalTasks = empTaskGroups.reduce((sum: number, g: UserCountGroup) => sum + g._count.id, 0);
      const empApprovedTasks = empTaskGroups.find((g: UserCountGroup) => g.status === 'Approved')?._count.id || 0;
      const empRejectedTasks = empTaskGroups.find((g: UserCountGroup) => g.status === 'Rejected')?._count.id || 0;
      const empOverdueTasks = teamOverdueGroups.find((g: UserCountGroup) => g.assignedToId === emp.id)?._count.id || 0;
      const empDailyReports = teamReportGroups.find((g: UserCountGroup) => g.userId === emp.id)?._count.id || 0;

      return {
        id: emp.id,
        name: emp.name,
        totalTasks: empTotalTasks,
        approved: empApprovedTasks,
        rejected: empRejectedTasks,
        overdue: empOverdueTasks,
        reportsSubmitted: empDailyReports,
        score: calculatePerformanceScore(empApprovedTasks, empOverdueTasks, empRejectedTasks, empTotalTasks, 100)
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
      where: { assignedToId: userId, isDeleted: false },
      _count: { id: true }
    });

    const myTotalTasks = taskStatusCounts.reduce((acc: number, curr: StatusCountGroup) => acc + curr._count.id, 0);
    const myPendingTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Pending')?._count.id || 0;
    const myInProgressTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'In Progress')?._count.id || 0;
    const mySubmittedTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Submitted')?._count.id || 0;
    const myApprovedTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Approved')?._count.id || 0;
    const myRejectedTasks = taskStatusCounts.find((s: StatusCountGroup) => s.status === 'Rejected')?._count.id || 0;

    const [
      myOverdueTasks,
      todayReport, myRecentTasks, myUpcomingDeadlines, myRejectedTasksWithFeedback, myRecentDailyReports, user
    ] = await Promise.all([
      prisma.task.count({ where: { assignedToId: userId, isDeleted: false, deadline: { lt: new Date() }, status: { not: 'Approved' } } }),
      
      prisma.dailyReport.findFirst({ where: { userId, isDeleted: false, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.task.findMany({ where: { assignedToId: userId, isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.task.findMany({ where: { assignedToId: userId, isDeleted: false, deadline: { gte: new Date() }, status: { not: 'Approved' } }, orderBy: { deadline: 'asc' }, take: 5 }),
      prisma.taskSubmission.findMany({ where: { userId, isDeleted: false, reviewStatus: 'Rejected', task: { isDeleted: false } }, include: { task: true }, orderBy: { reviewedAt: 'desc' }, take: 3 }),
      prisma.dailyReport.findMany({ where: { userId, isDeleted: false }, orderBy: { reportDate: 'desc' }, take: 5 }),
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

    res.json(responseData);
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
      prisma.dailyReport.count({ where: { isDeleted: false, reportDate: { gte: today, lt: tomorrow } } }),
      prisma.task.count({ where: { isDeleted: false } }),
      prisma.task.count({ where: { isDeleted: false, status: 'Approved' } }),
      prisma.dailyReport.findMany({
        where: { isDeleted: false },
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

    const departmentWiseEmployees = departments.map((dept: DeptItem) => ({
      name: dept.name,
      count: departmentUserCountsRaw.find((g: DeptCountGroup) => g.departmentId === dept.id)?._count.id || 0
    }));

    const dailyReportCompliance = expectedSubmitters > 0 ? ((todayReports / expectedSubmitters) * 100).toFixed(1) : 0;
    const taskCompletionOverview = totalTasks > 0 ? ((approvedTasks / totalTasks) * 100).toFixed(1) : 0;

    const responseData = {
      totalEmployees, activeEmployees, inactiveEmployees,
      departmentWiseEmployees, dailyReportCompliance, taskCompletionOverview, recentReports
    };

    res.json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading HR dashboard' });
  }
};
