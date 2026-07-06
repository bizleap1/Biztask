import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const clearAllData = async (req: Request, res: Response) => {
  try {
    // We must respect foreign key constraints. 
    // Delete in this order:
    // 1. Comments, ActivityLogs, Notifications (Depend on Tasks/Users)
    // 2. TaskSubmissions (Depend on Tasks)
    // 3. DailyReports (Depend on Users/Departments)
    // 4. Tasks (Depend on Users/Departments)

    await prisma.$transaction([
      prisma.comment.deleteMany(),
      prisma.activityLog.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.taskSubmission.deleteMany(),
      prisma.dailyReport.deleteMany(),
      prisma.task.deleteMany()
    ]);

    // Optional: Log this massive action
    // @ts-ignore
    if (req.user && req.user.id) {
      await prisma.activityLog.create({
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
  } catch (error) {
    console.error('Error clearing system data:', error);
    res.status(500).json({ message: 'Failed to clear system data', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
