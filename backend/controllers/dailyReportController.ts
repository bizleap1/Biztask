import { Response } from 'express';
import { createActivityLog } from '../utils/activityLogUtils';
import { createNotification } from '../utils/notificationUtils';
import { AuthRequest } from '../middleware/authMiddleware';
import { calculateMonthlyReportRate } from '../utils/reportUtils';

import prisma from '../prismaClient';

// @desc    Submit a daily report
// @route   POST /api/daily-reports
// @access  Private (Employee)
export const submitReport = async (req: AuthRequest, res: Response) => {
  try {
    const { reportDate, workCompleted, pendingWork, blockers, tomorrowPlan, attachments, taskIds } = req.body;
    const userId = req.user!.id;
    const departmentId = req.user!.departmentId;

    if (!departmentId) {
      return res.status(400).json({ message: 'User does not belong to a department' });
    }

    // Check for duplicate report on the same date
    const dateObj = new Date(reportDate);
    const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0));
    const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999));

    const existingReport = await prisma.dailyReport.findFirst({
      where: {
        userId,
        reportDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    if (existingReport) {
      return res.status(400).json({ message: 'Daily report already submitted for this date.' });
    }

    const report = await prisma.dailyReport.create({
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

    await createActivityLog({
      userId,
      action: 'DAILY_REPORT_SUBMITTED',
      entityType: 'DailyReport',
      entityId: report.id,
      description: `Submitted daily report for ${reportDate}`,
      req
    });

    const admins = await prisma.user.findMany({
      where: { role: { in: ['SuperAdmin', 'Manager'] } },
      select: { id: true }
    });

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        title: 'Daily Report Submitted',
        message: `Daily report submitted by user ID ${userId}`,
        type: 'daily_report_submitted',
        entityType: 'DailyReport',
        entityId: report.id
      });
    }

    res.status(201).json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all reports (with filters)
// @route   GET /api/daily-reports
// @access  Private (SuperAdmin, Manager)
export const getAllReports = async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, departmentId, status, startDate, endDate } = req.query;
    const { role, departmentId: userDeptId } = req.user!;

    let whereClause: any = {};

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
      if (startDate) whereClause.reportDate.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        whereClause.reportDate.lte = end;
      }
    }

    const reports = await prisma.dailyReport.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
        department: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } }
      },
      orderBy: { reportDate: 'desc' }
    });

    // Fetch live monthly submission rate for each report's user
    const reportsWithRates = await Promise.all(reports.map(async (report) => {
      const rate = await calculateMonthlyReportRate(report.userId);
      return { ...report, user: { ...report.user, reportSubmissionRate: rate } };
    }));

    res.json(reportsWithRates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get my reports
// @route   GET /api/daily-reports/my
// @access  Private
export const getMyReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await prisma.dailyReport.findMany({
      where: { userId: req.user!.id },
      include: {
        department: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } }
      },
      orderBy: { reportDate: 'desc' }
    });

    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single report
// @route   GET /api/daily-reports/:id
// @access  Private
export const getReportById = async (req: AuthRequest, res: Response) => {
  try {
    const report = await prisma.dailyReport.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, designation: true } },
        department: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } }
      }
    });

    if (!report) return res.status(404).json({ message: 'Report not found' });

    // Authorization
    const { id, role, departmentId } = req.user!;
    if (role === 'Viewer') return res.status(403).json({ message: 'Forbidden' });
    if (role !== 'SuperAdmin' && role !== 'Manager' && report.userId !== id) return res.status(403).json({ message: 'Forbidden' });

    res.json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update my report
// @route   PUT /api/daily-reports/:id
// @access  Private (Employee)
export const updateReport = async (req: AuthRequest, res: Response) => {
  try {
    const reportId = Number(req.params.id);
    const report = await prisma.dailyReport.findUnique({ where: { id: reportId } });

    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (report.userId !== req.user!.id) return res.status(403).json({ message: 'Forbidden' });
    if (report.status === 'Reviewed') return res.status(400).json({ message: 'Cannot edit a reviewed report' });

    const { workCompleted, pendingWork, blockers, tomorrowPlan, attachments, taskIds } = req.body;

    const updated = await prisma.dailyReport.update({
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Review report
// @route   PATCH /api/daily-reports/:id/review
// @access  Private (SuperAdmin, Manager)
export const reviewReport = async (req: AuthRequest, res: Response) => {
  try {
    const reportId = Number(req.params.id);
    const { managerFeedback } = req.body;

    const updated = await prisma.dailyReport.update({
      where: { id: reportId },
      data: {
        status: 'Reviewed',
        managerFeedback,
        reviewedById: req.user!.id,
        reviewedAt: new Date()
      }
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'DAILY_REPORT_REVIEWED',
      entityType: 'DailyReport',
      entityId: updated.id,
      description: `Reviewed daily report ID ${reportId}`,
      req
    });

    await createNotification({
      userId: updated.userId,
      title: 'Daily Report Reviewed',
      message: 'Your daily report has been reviewed.',
      type: 'daily_report_reviewed',
      entityType: 'DailyReport',
      entityId: updated.id
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark report as needs correction
// @route   PATCH /api/daily-reports/:id/needs-correction
// @access  Private (SuperAdmin, Manager)
export const markNeedsCorrection = async (req: AuthRequest, res: Response) => {
  try {
    const reportId = Number(req.params.id);
    const { managerFeedback } = req.body;

    if (!managerFeedback) {
      return res.status(400).json({ message: 'Feedback is required for corrections' });
    }

    const updated = await prisma.dailyReport.update({
      where: { id: reportId },
      data: {
        status: 'Needs Correction',
        managerFeedback,
        reviewedById: req.user!.id,
        reviewedAt: new Date()
      }
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'DAILY_REPORT_NEEDS_CORRECTION',
      entityType: 'DailyReport',
      entityId: updated.id,
      description: `Marked daily report ID ${reportId} as needs correction`,
      req
    });

    await createNotification({
      userId: updated.userId,
      title: 'Daily Report Needs Correction',
      message: 'Your daily report needs correction. Please check feedback.',
      type: 'daily_report_correction',
      entityType: 'DailyReport',
      entityId: updated.id
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete/Archive report
// @route   DELETE /api/daily-reports/:id
// @access  Private (SuperAdmin)
export const deleteReport = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.dailyReport.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
