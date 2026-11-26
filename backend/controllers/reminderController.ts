import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../prismaClient';
import { normalizeRole } from '../utils/rbac';

export type ReminderCategory =
  | 'overdue_task'
  | 'upcoming_task'
  | 'missing_daily_report'
  | 'pending_review'
  | 'report_correction';

export type ReminderSeverity = 'high' | 'medium' | 'low';

export interface ReminderTemplate {
  key: ReminderCategory;
  label: string;
  emailSubject: string;
  emailBody: string;
  whatsappText: string;
}

export const REMINDER_TEMPLATES: Record<ReminderCategory, ReminderTemplate> = {
  overdue_task: {
    key: 'overdue_task',
    label: 'Overdue Task Follow-up',
    emailSubject: 'Action Required: Overdue Task - {{taskTitle}}',
    emailBody:
      'Hi {{name}},\n\nThis is a reminder that the task "{{taskTitle}}" was due on {{dueDate}} and is currently overdue. Please update its status or submit your work as soon as possible.\n\nThanks,\nBizLeap Team',
    whatsappText:
      'Hi {{name}}, reminder: your task "{{taskTitle}}" was due on {{dueDate}} and is overdue. Please update or submit it on BizLeap ASAP.',
  },
  upcoming_task: {
    key: 'upcoming_task',
    label: 'Upcoming Deadline Reminder',
    emailSubject: 'Upcoming Deadline: {{taskTitle}}',
    emailBody:
      'Hi {{name}},\n\nJust a quick heads-up that the task "{{taskTitle}}" is due on {{dueDate}}. Let us know if you have any blockers.\n\nBest,\nBizLeap Team',
    whatsappText:
      'Hi {{name}}, friendly reminder that "{{taskTitle}}" is due on {{dueDate}}. Please reach out if you have any blockers.',
  },
  missing_daily_report: {
    key: 'missing_daily_report',
    label: 'Missing Daily Report',
    emailSubject: 'Daily Report Reminder for Today',
    emailBody:
      'Hi {{name}},\n\nWe noticed you have not submitted your Daily Report for today yet. Please log your completed work and tomorrow\'s plan on BizLeap before end of day.\n\nThanks,\nBizLeap Team',
    whatsappText:
      'Hi {{name}}, please remember to submit your Daily Report for today on BizLeap before signing off.',
  },
  pending_review: {
    key: 'pending_review',
    label: 'Pending Submission Review',
    emailSubject: 'Submission Ready for Review: {{taskTitle}}',
    emailBody:
      'Hi {{name}},\n\nA task submission for "{{taskTitle}}" is waiting for your review on BizLeap.\n\nThanks,\nBizLeap Team',
    whatsappText:
      'Hi {{name}}, a submission for "{{taskTitle}}" is pending review on BizLeap.',
  },
  report_correction: {
    key: 'report_correction',
    label: 'Daily Report Needs Correction',
    emailSubject: 'Daily Report Needs Correction',
    emailBody:
      'Hi {{name}},\n\nYour Daily Report has been marked as "Needs Correction". Please review the feedback and update your report on BizLeap.\n\nThanks,\nBizLeap Team',
    whatsappText:
      'Hi {{name}}, your Daily Report on BizLeap needs a correction. Please check the feedback and resubmit.',
  },
};

const renderTemplateString = (
  template: string,
  variables: Record<string, string | undefined>
): string => {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? '');
};

const sanitizePhone = (rawPhone: string): string => {
  return rawPhone.replace(/[^\d]/g, '');
};

const isManagerOrLead = (role: string): boolean => {
  const normalized = normalizeRole(role);
  return ['SuperAdmin', 'Manager', 'TeamLead'].includes(normalized);
};

export const getUnifiedReminders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const privileged = isManagerOrLead(role);
    const { category, severity } = req.query;

    const now = new Date();
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfToday = new Date(startOfToday);
    endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

    const taskWhere = {
      isDeleted: false,
      status: { notIn: ['Approved', 'Completed'] },
      deadline: { lte: next48h },
      ...(privileged ? {} : { assignedToId: userId }),
    };

    const staffWhere = privileged
      ? { isActive: true, role: { in: ['Employee', 'DevEmployee', 'MediaEmployee', 'TeamLead'] } }
      : { id: userId, isActive: true };

    const correctionWhere = {
      isDeleted: false,
      status: 'Needs Correction',
      ...(privileged ? {} : { userId }),
    };

    const [tasks, staffUsers, todayReports, pendingSubmissions, correctionReports] =
      await Promise.all([
        prisma.task.findMany({
          where: taskWhere,
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true, phone: true, whatsappNumber: true },
            },
            department: { select: { name: true } },
          },
          orderBy: { deadline: 'asc' },
          take: 50,
        }),
        prisma.user.findMany({
          where: staffWhere,
          select: { id: true, name: true, email: true, phone: true, whatsappNumber: true },
        }),
        prisma.dailyReport.findMany({
          where: {
            isDeleted: false,
            reportDate: { gte: startOfToday, lt: endOfToday },
            ...(privileged ? {} : { userId }),
          },
          select: { userId: true },
        }),
        privileged
          ? prisma.taskSubmission.findMany({
              where: {
                isDeleted: false,
                reviewStatus: 'Pending Review',
                task: { isDeleted: false },
              },
              include: {
                user: {
                  select: { id: true, name: true, email: true, phone: true, whatsappNumber: true },
                },
                task: { select: { id: true, title: true } },
              },
              orderBy: { submittedAt: 'asc' },
              take: 25,
            })
          : Promise.resolve([]),
        prisma.dailyReport.findMany({
          where: correctionWhere,
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true, whatsappNumber: true },
            },
          },
          orderBy: { reportDate: 'desc' },
          take: 25,
        }),
      ]);

    const reminders: Array<{
      id: string;
      category: ReminderCategory;
      severity: ReminderSeverity;
      title: string;
      description: string;
      dueAt: string | null;
      targetUser: {
        id: number;
        name: string;
        email: string;
        phone: string | null;
        whatsappNumber: string | null;
      } | null;
      actionUrl: string;
    }> = [];

    for (const task of tasks) {
      const isOverdue = new Date(task.deadline) < now;
      reminders.push({
        id: `task-${task.id}`,
        category: isOverdue ? 'overdue_task' : 'upcoming_task',
        severity: isOverdue ? 'high' : 'medium',
        title: task.title,
        description: isOverdue
          ? `Overdue in ${task.department?.name ?? 'General'} — assigned to ${task.assignedTo?.name ?? 'Unassigned'}`
          : `Due soon in ${task.department?.name ?? 'General'} — assigned to ${task.assignedTo?.name ?? 'Unassigned'}`,
        dueAt: new Date(task.deadline).toISOString(),
        targetUser: task.assignedTo ?? null,
        actionUrl: `/tasks/${task.id}`,
      });
    }

    const submittedUserIds = new Set(todayReports.map((r) => r.userId));
    for (const staff of staffUsers) {
      if (!submittedUserIds.has(staff.id)) {
        reminders.push({
          id: `missing-report-${staff.id}`,
          category: 'missing_daily_report',
          severity: 'medium',
          title: `Missing Daily Report: ${staff.name}`,
          description: `${staff.name} has not submitted today's daily report yet.`,
          dueAt: endOfToday.toISOString(),
          targetUser: staff,
          actionUrl: privileged ? '/daily-reports' : '/my-daily-reports',
        });
      }
    }

    for (const sub of pendingSubmissions) {
      reminders.push({
        id: `submission-${sub.id}`,
        category: 'pending_review',
        severity: 'medium',
        title: `Pending Review: ${sub.task.title}`,
        description: `Submitted by ${sub.user.name} and awaiting manager review.`,
        dueAt: new Date(sub.submittedAt).toISOString(),
        targetUser: sub.user,
        actionUrl: '/review-submissions',
      });
    }

    for (const report of correctionReports) {
      reminders.push({
        id: `report-correction-${report.id}`,
        category: 'report_correction',
        severity: 'high',
        title: `Report Needs Correction: ${report.user.name}`,
        description: report.managerFeedback
          ? `Feedback: ${report.managerFeedback}`
          : 'Daily report marked as Needs Correction.',
        dueAt: new Date(report.reportDate).toISOString(),
        targetUser: report.user,
        actionUrl: privileged ? '/daily-reports' : '/my-daily-reports',
      });
    }

    const filtered = reminders.filter((item) => {
      if (category && item.category !== String(category)) return false;
      if (severity && item.severity !== String(severity)) return false;
      return true;
    });

    const summary = {
      total: filtered.length,
      high: filtered.filter((r) => r.severity === 'high').length,
      medium: filtered.filter((r) => r.severity === 'medium').length,
      low: filtered.filter((r) => r.severity === 'low').length,
    };

    res.json({ reminders: filtered, summary });
  } catch (error) {
    console.error('Get Unified Reminders Error:', error);
    res.status(500).json({ message: 'Failed to load reminders' });
  }
};

export const getReminderTemplates = (_req: AuthRequest, res: Response): void => {
  res.json({ templates: Object.values(REMINDER_TEMPLATES) });
};

export const buildWhatsAppLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phone, templateKey, variables = {}, customMessage } = req.body as {
      phone?: string;
      templateKey?: ReminderCategory;
      variables?: Record<string, string | undefined>;
      customMessage?: string;
    };

    if (!phone || !sanitizePhone(phone)) {
      res.status(400).json({ message: 'A valid phone number is required for WhatsApp' });
      return;
    }

    const digits = sanitizePhone(phone);
    const template = templateKey ? REMINDER_TEMPLATES[templateKey] : undefined;
    const message =
      customMessage?.trim() ||
      (template ? renderTemplateString(template.whatsappText, variables) : '');

    if (!message) {
      res.status(400).json({ message: 'A message or valid templateKey is required' });
      return;
    }

    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'REMINDER_WHATSAPP_LINK',
        entityType: 'Reminder',
        description: `Generated WhatsApp reminder link for ${digits}`,
      },
    });

    res.json({ url, phone: digits, message });
  } catch (error) {
    console.error('Build WhatsApp Link Error:', error);
    res.status(500).json({ message: 'Failed to generate WhatsApp link' });
  }
};

export const buildEmailDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { to, templateKey, variables = {}, subject: customSubject, body: customBody } =
      req.body as {
        to?: string;
        templateKey?: ReminderCategory;
        variables?: Record<string, string | undefined>;
        subject?: string;
        body?: string;
      };

    if (!to || !to.includes('@')) {
      res.status(400).json({ message: 'A valid recipient email address is required' });
      return;
    }

    const template = templateKey ? REMINDER_TEMPLATES[templateKey] : undefined;
    const subject =
      customSubject?.trim() ||
      (template ? renderTemplateString(template.emailSubject, variables) : '');
    const body =
      customBody?.trim() ||
      (template ? renderTemplateString(template.emailBody, variables) : '');

    if (!subject || !body) {
      res.status(400).json({ message: 'Subject and body (or valid templateKey) are required' });
      return;
    }

    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'REMINDER_EMAIL_DRAFT',
        entityType: 'Reminder',
        description: `Generated email reminder draft for ${to}`,
      },
    });

    res.json({ to, subject, body, mailtoUrl, gmailComposeUrl });
  } catch (error) {
    console.error('Build Email Draft Error:', error);
    res.status(500).json({ message: 'Failed to generate email draft' });
  }
};
