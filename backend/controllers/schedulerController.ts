/**
 * Sprint 8 — Scheduled Jobs & Escalations (F25)
 *
 * All job functions are idempotent: they check for an existing notification
 * created within the deduplication window before writing a new one.
 * This file exposes pure async functions so the cron worker and the
 * manual-trigger HTTP handler can both call them.
 */

import prisma from '../prismaClient';
import { createNotification } from '../utils/notificationUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobResult {
  job: string;
  processed: number;
  skipped: number;
  errors: number;
}

async function recordJobAttempt(jobName: string, fn: () => Promise<JobResult>): Promise<JobResult> {
  const prismaWithJobs = prisma as unknown as {
    scheduledJob?: { upsert: (args: unknown) => Promise<unknown>; findUnique?: (args: unknown) => Promise<unknown> };
    scheduledJobAttempt?: { create: (args: unknown) => Promise<unknown>; update: (args: unknown) => Promise<unknown> };
  };
  let attemptId: number | null = null;
  if (prismaWithJobs.scheduledJob && prismaWithJobs.scheduledJobAttempt) {
    await prismaWithJobs.scheduledJob.upsert({
      where: { name: jobName },
      create: { name: jobName, enabled: true },
      update: { updatedAt: new Date() }
    });
    const attempt = await prismaWithJobs.scheduledJobAttempt.create({
      data: { jobName, status: 'Running', startedAt: new Date() }
    }) as { id: number };
    attemptId = attempt.id;
  }
  try {
    const result = await fn();
    if (attemptId && prismaWithJobs.scheduledJobAttempt) {
      await prismaWithJobs.scheduledJobAttempt.update({
        where: { id: attemptId },
        data: {
          status: result.errors > 0 ? 'Failed' : 'Succeeded',
          completedAt: new Date(),
          processed: result.processed,
          skipped: result.skipped,
          errors: result.errors
        }
      });
    }
    return result;
  } catch (error) {
    if (attemptId && prismaWithJobs.scheduledJobAttempt) {
      await prismaWithJobs.scheduledJobAttempt.update({
        where: { id: attemptId },
        data: { status: 'Failed', completedAt: new Date(), errors: 1, errorMessage: error instanceof Error ? error.message : 'Unknown scheduler error' }
      });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helper: has a notification already been sent in the last N ms?
// ---------------------------------------------------------------------------
async function alreadyNotified(
  userId: number,
  type: string,
  entityId: number | null,
  windowMs: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const where: Record<string, unknown> = {
    userId,
    type,
    createdAt: { gte: since }
  };
  if (entityId !== null) where.entityId = entityId;

  const existing = await prisma.notification.findFirst({ where });
  return existing !== null;
}

// ---------------------------------------------------------------------------
// Job 1: 7 PM daily-report reminder
// Fires every day at 19:00. Notifies every active, non-admin employee who
// hasn't submitted a daily report today (UTC).
// ---------------------------------------------------------------------------
export async function runDailyReportReminderJob(): Promise<JobResult> {
  const result: JobResult = { job: 'daily_report_reminder', processed: 0, skipped: 0, errors: 0 };

  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Active non-admin employees
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['Employee', 'DevEmployee', 'MediaEmployee', 'TeamLead'] }
      },
      select: { id: true, name: true }
    });

    for (const emp of employees) {
      try {
        // Did they already submit today?
        const submitted = await prisma.dailyReport.findFirst({
          where: {
            userId: emp.id,
            createdAt: { gte: todayStart, lte: todayEnd }
          }
        });
        if (submitted) { result.skipped++; continue; }

        // Already sent a reminder in the last 23 hours?
        const dup = await alreadyNotified(emp.id, 'daily_report_reminder', null, 23 * 60 * 60 * 1000);
        if (dup) { result.skipped++; continue; }

        await createNotification({
          userId: emp.id,
          title: 'Daily Report Reminder',
          message: "Don't forget to submit your daily report before end of day.",
          type: 'daily_report_reminder',
          entityType: 'DailyReport',
          entityId: emp.id
        });
        result.processed++;
      } catch {
        result.errors++;
      }
    }
  } catch (err) {
    console.error('[Scheduler] daily_report_reminder error:', err);
    result.errors++;
  }

  console.log(`[Scheduler] ${result.job}:`, result);
  return result;
}

// ---------------------------------------------------------------------------
// Job 2: Deadline approaching & overdue (runs hourly)
// Enhanced version of notificationController.checkDeadlines.
// ---------------------------------------------------------------------------
export async function runDeadlineCheckJob(): Promise<JobResult> {
  const result: JobResult = { job: 'deadline_check', processed: 0, skipped: 0, errors: 0 };
  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const WINDOW = 23 * 60 * 60 * 1000;

  try {
    // --- Approaching ---
    const approaching = await prisma.task.findMany({
      where: {
        isDeleted: false,
        deadline: { gt: now, lte: next24h },
        status: { notIn: ['Approved', 'Completed'] },
        assignedToId: { not: null },
        assignedTo: { isActive: true }
      }
    });

    for (const task of approaching) {
      try {
        const dup = await alreadyNotified(task.assignedToId!, 'deadline_reminder', task.id, WINDOW);
        if (dup) { result.skipped++; continue; }
        await createNotification({
          userId: task.assignedToId!,
          title: 'Deadline Approaching',
          message: `Task deadline is approaching: ${task.title}`,
          type: 'deadline_reminder',
          entityType: 'Task',
          entityId: task.id
        });
        result.processed++;
      } catch { result.errors++; }
    }

    // --- Overdue ---
    const overdue = await prisma.task.findMany({
      where: {
        isDeleted: false,
        deadline: { lt: now },
        status: { notIn: ['Approved', 'Completed'] },
        assignedToId: { not: null },
        assignedTo: { isActive: true }
      }
    });

    for (const task of overdue) {
      try {
        const dup = await alreadyNotified(task.assignedToId!, 'task_overdue', task.id, WINDOW);
        if (dup) { result.skipped++; continue; }
        await createNotification({
          userId: task.assignedToId!,
          title: 'Task Overdue',
          message: `Task is overdue: ${task.title}`,
          type: 'task_overdue',
          entityType: 'Task',
          entityId: task.id
        });
        result.processed++;
      } catch { result.errors++; }
    }

    // --- Manager escalation: tasks overdue > 48h with no status change ---
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const escalatable = await prisma.task.findMany({
      where: {
        isDeleted: false,
        deadline: { lt: twoDaysAgo },
        status: { notIn: ['Approved', 'Completed'] },
        assignedToId: { not: null }
      },
      include: { assignedTo: true }
    });

    // Prefer the task assignee's nested/known manager, otherwise escalate to active managers.
    const managers = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['SuperAdmin', 'Manager'] } },
      select: { id: true }
    }).catch(() => []);

    for (const task of escalatable) {
      const directManagerId = (task as unknown as { assignedTo?: { manager?: { id?: number; isActive?: boolean } } })
        .assignedTo?.manager?.id;
      const recipients = directManagerId
        ? [{ id: directManagerId }]
        : managers;
      for (const manager of recipients) {
        try {
          const dup = await alreadyNotified(manager.id, 'escalation_overdue', task.id, 24 * 60 * 60 * 1000);
          if (dup) { result.skipped++; continue; }
          await createNotification({
            userId: manager.id,
            title: 'Escalation: Overdue Task',
            message: `Task "${task.title}" assigned to ${task.assignedTo?.name ?? 'employee'} is overdue by more than 48 hours.`,
            type: 'escalation_overdue',
            entityType: 'Task',
            entityId: task.id
          });
          result.processed++;
        } catch { result.errors++; }
      }
    }
  } catch (err) {
    console.error('[Scheduler] deadline_check error:', err);
    result.errors++;
  }

  console.log(`[Scheduler] ${result.job}:`, result);
  return result;
}

// ---------------------------------------------------------------------------
// Job 3: Upcoming meeting reminders (runs every 30 min)
// ---------------------------------------------------------------------------
export async function runMeetingReminderJob(): Promise<JobResult> {
  const result: JobResult = { job: 'meeting_reminder', processed: 0, skipped: 0, errors: 0 };
  const now = new Date();
  const next2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const WINDOW = 90 * 60 * 1000; // 90 min dedup window

  try {
    const upcomingMeetings = await prisma.meeting.findMany({
      where: {
        startAt: { gt: now, lte: next2h },
        status: { not: 'Cancelled' },
        isDeleted: false
      },
      include: { attendees: { select: { userId: true } } }
    });

    for (const meeting of upcomingMeetings) {
      for (const attendee of meeting.attendees) {
        try {
          const dup = await alreadyNotified(attendee.userId, 'meeting_reminder', meeting.id, WINDOW);
          if (dup) { result.skipped++; continue; }
          await createNotification({
            userId: attendee.userId,
            title: 'Meeting Reminder',
            message: `Your meeting "${meeting.title}" starts in less than 2 hours.`,
            type: 'meeting_reminder',
            entityType: 'Meeting',
            entityId: meeting.id
          });
          result.processed++;
        } catch { result.errors++; }
      }
    }
  } catch (err) {
    console.error('[Scheduler] meeting_reminder error:', err);
    result.errors++;
  }

  console.log(`[Scheduler] ${result.job}:`, result);
  return result;
}

// ---------------------------------------------------------------------------
// Job 4: Invoice overdue reminders (runs daily at 9 AM)
// ---------------------------------------------------------------------------
export async function runInvoiceOverdueJob(): Promise<JobResult> {
  const result: JobResult = { job: 'invoice_overdue', processed: 0, skipped: 0, errors: 0 };
  const now = new Date();
  const WINDOW = 23 * 60 * 60 * 1000;

  try {
    // Find managers/SuperAdmins to notify about overdue invoices
    const admins = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['SuperAdmin', 'Manager'] } },
      select: { id: true }
    });

    if (admins.length === 0) return result;

    // Check if Invoice model exists (may not until Sprint 10)
    const hasInvoice = (prisma as unknown as Record<string, unknown>)['invoice'] !== undefined;
    if (!hasInvoice) {
      console.log('[Scheduler] invoice_overdue: Invoice model not yet available, skipping');
      return result;
    }

    const overdueInvoices = await (prisma as unknown as {
      invoice: { findMany: (args: unknown) => Promise<Array<{ id: number; invoiceNumber: string }>> }
    }).invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['sent', 'viewed'] }
      },
      select: { id: true, invoiceNumber: true }
    });

    for (const invoice of overdueInvoices) {
      for (const admin of admins) {
        try {
          const dup = await alreadyNotified(admin.id, 'invoice_overdue', invoice.id, WINDOW);
          if (dup) { result.skipped++; continue; }
          await createNotification({
            userId: admin.id,
            title: 'Invoice Overdue',
            message: `Invoice #${invoice.invoiceNumber} is overdue.`,
            type: 'invoice_overdue',
            entityType: 'Invoice',
            entityId: invoice.id
          });
          result.processed++;
        } catch { result.errors++; }
      }
    }
  } catch (err) {
    console.error('[Scheduler] invoice_overdue error:', err);
    result.errors++;
  }

  console.log(`[Scheduler] ${result.job}:`, result);
  return result;
}

// ---------------------------------------------------------------------------
// runAllJobs — called by the manual HTTP trigger
// ---------------------------------------------------------------------------
export async function runAllJobs(): Promise<JobResult[]> {
  const results = await Promise.allSettled([
    recordJobAttempt('daily_report_reminder', runDailyReportReminderJob),
    recordJobAttempt('deadline_check', runDeadlineCheckJob),
    recordJobAttempt('meeting_reminder', runMeetingReminderJob),
    recordJobAttempt('invoice_overdue', runInvoiceOverdueJob)
  ]);

  return results.map((r, i) => {
    const names = ['daily_report_reminder', 'deadline_check', 'meeting_reminder', 'invoice_overdue'];
    if (r.status === 'fulfilled') return r.value;
    return { job: names[i], processed: 0, skipped: 0, errors: 1 };
  });
}
