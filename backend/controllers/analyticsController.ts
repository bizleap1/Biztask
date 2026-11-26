import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../prismaClient';

interface DeptTaskGroup {
  departmentId: number;
  status: string;
  _count: { id: number };
}

interface StatusGroup {
  status: string;
  _count: { id: number };
}

interface RoleGroup {
  role: string;
  _count: { id: number };
}

interface DepartmentRow {
  id: number;
  name: string;
}

interface CompletedTaskRow {
  departmentId: number;
  createdAt: Date;
  updatedAt: Date;
}

interface LoginLogRow {
  createdAt: Date;
}

export const getOverview = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsers,
      activeUsers,
      totalTasks,
      completedTasks,
      pendingTasks,
      recentSubmissions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.task.count({ where: { isDeleted: false } }),
      prisma.task.count({ where: { isDeleted: false, status: 'Approved' } }),
      prisma.task.count({
        where: {
          isDeleted: false,
          status: { in: ['Pending', 'In Progress', 'Submitted'] },
        },
      }),
      prisma.taskSubmission.count({
        where: {
          isDeleted: false,
          submittedAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    res.json({
      totalUsers,
      activeUsers,
      totalTasks,
      completedTasks,
      pendingTasks,
      recentSubmissions,
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ message: 'Error loading analytics overview' });
  }
};

export const getTaskMetrics = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [departments, deptStatusGroups, completedTasks, statusGroups] = await Promise.all([
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.task.groupBy({
        by: ['departmentId', 'status'],
        where: { isDeleted: false },
        _count: { id: true },
      }),
      prisma.task.findMany({
        where: { isDeleted: false, status: 'Approved' },
        select: { departmentId: true, createdAt: true, updatedAt: true },
      }),
      prisma.task.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { id: true },
      }),
    ]);

    const byDepartment = (departments as DepartmentRow[]).map((dept) => {
      const groups = (deptStatusGroups as DeptTaskGroup[]).filter(
        (g) => g.departmentId === dept.id
      );
      const totalTasks = groups.reduce((sum, g) => sum + g._count.id, 0);
      const completedCount =
        groups.find((g) => g.status === 'Approved')?._count.id ?? 0;
      const pendingCount = groups
        .filter((g) => g.status !== 'Approved')
        .reduce((sum, g) => sum + g._count.id, 0);

      const deptCompleted = (completedTasks as CompletedTaskRow[]).filter(
        (t) => t.departmentId === dept.id
      );
      const avgCompletionHours =
        deptCompleted.length > 0
          ? Number(
              (
                deptCompleted.reduce((sum, t) => {
                  const diffMs =
                    new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
                  return sum + Math.max(0, diffMs / (1000 * 60 * 60));
                }, 0) / deptCompleted.length
              ).toFixed(1)
            )
          : 0;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalTasks,
        completedTasks: completedCount,
        pendingTasks: pendingCount,
        avgCompletionHours,
      };
    });

    const statusBreakdown = (statusGroups as StatusGroup[]).map((g) => ({
      status: g.status,
      count: g._count.id,
    }));

    res.json({ byDepartment, statusBreakdown });
  } catch (error) {
    console.error('Error fetching task metrics:', error);
    res.status(500).json({ message: 'Error loading task metrics' });
  }
};

export const getUserActivity = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = 14;
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));

    const [loginLogs, roleGroups] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          isDeleted: false,
          action: { in: ['LOGIN', 'Login', 'USER_LOGIN'] },
          createdAt: { gte: startDate },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
    ]);

    const dayCounts = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayCounts.set(key, 0);
    }

    for (const log of loginLogs as LoginLogRow[]) {
      const key = new Date(log.createdAt).toISOString().slice(0, 10);
      if (dayCounts.has(key)) {
        dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
      }
    }

    const loginsByDay = Array.from(dayCounts.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    const roleDistribution = (roleGroups as RoleGroup[]).map((g) => ({
      role: g.role,
      count: g._count.id,
    }));

    res.json({ loginsByDay, roleDistribution });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ message: 'Error loading user activity' });
  }
};
