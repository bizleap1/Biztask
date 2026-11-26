/**
 * Sprint 8 — Scheduled Jobs & Escalations Tests (F25)
 *
 * Tests the job logic functions directly (mocking Prisma).
 * All tests use vitest + vi.mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Prisma ─────────────────────────────────────────────────────────────
vi.mock('../prismaClient', () => ({
  default: {
    user: { findMany: vi.fn() },
    dailyReport: { findFirst: vi.fn() },
    notification: { findFirst: vi.fn(), create: vi.fn() },
    task: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() }
  }
}));

vi.mock('../utils/notificationUtils', () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 1 })
}));

import prisma from '../prismaClient';
import { createNotification } from '../utils/notificationUtils';
import {
  runDailyReportReminderJob,
  runDeadlineCheckJob,
  runMeetingReminderJob,
  runInvoiceOverdueJob,
  runAllJobs
} from '../controllers/schedulerController';

const mockPrisma = prisma as unknown as {
  user: { findMany: ReturnType<typeof vi.fn> };
  dailyReport: { findFirst: ReturnType<typeof vi.fn> };
  notification: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  task: { findMany: ReturnType<typeof vi.fn> };
  meeting: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

// ─── Test 1: Daily report reminder — sends when not submitted ─────────────────
describe('Sprint 8 — Scheduled Jobs', () => {
  it('T8-01: daily report reminder sends to employees who have not submitted', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 10, name: 'Alice' }]);
    mockPrisma.dailyReport.findFirst.mockResolvedValue(null);  // not submitted
    mockPrisma.notification.findFirst.mockResolvedValue(null); // no dup

    const result = await runDailyReportReminderJob();

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'daily_report_reminder', userId: 10 })
    );
  });

  it('T8-02: daily report reminder skips employees who already submitted today', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 11, name: 'Bob' }]);
    mockPrisma.dailyReport.findFirst.mockResolvedValue({ id: 5 }); // already submitted

    const result = await runDailyReportReminderJob();

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('T8-03: daily report reminder skips if reminder already sent (idempotency)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 12, name: 'Carol' }]);
    mockPrisma.dailyReport.findFirst.mockResolvedValue(null);        // not submitted
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 99 }); // dup exists

    const result = await runDailyReportReminderJob();

    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(createNotification).not.toHaveBeenCalled();
  });

  // ─── Deadline check tests ───────────────────────────────────────────────────
  it('T8-04: deadline check notifies assignee for approaching task', async () => {
    // approaching, overdue, escalatable
    mockPrisma.task.findMany
      .mockResolvedValueOnce([{ id: 1, title: 'Fix Bug', assignedToId: 20 }]) // approaching
      .mockResolvedValueOnce([])  // overdue
      .mockResolvedValueOnce([]); // escalatable
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    const result = await runDeadlineCheckJob();

    expect(result.processed).toBe(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'deadline_reminder', entityId: 1 })
    );
  });

  it('T8-05: deadline check notifies assignee for overdue task', async () => {
    mockPrisma.task.findMany
      .mockResolvedValueOnce([])  // approaching
      .mockResolvedValueOnce([{ id: 2, title: 'Old Task', assignedToId: 21 }]) // overdue
      .mockResolvedValueOnce([]); // escalatable
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    const result = await runDeadlineCheckJob();

    expect(result.processed).toBe(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task_overdue', entityId: 2 })
    );
  });

  it('T8-06: deadline check escalates to manager for 48h+ overdue task', async () => {
    mockPrisma.task.findMany
      .mockResolvedValueOnce([])  // approaching
      .mockResolvedValueOnce([])  // overdue
      .mockResolvedValueOnce([{   // escalatable
        id: 3,
        title: 'Very Old Task',
        assignedToId: 22,
        assignedTo: { name: 'Dave', manager: { id: 30, isActive: true } }
      }]);
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    const result = await runDeadlineCheckJob();

    expect(result.processed).toBe(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'escalation_overdue', userId: 30 })
    );
  });

  it('T8-07: deadline check skips escalation if manager already notified (idempotency)', async () => {
    mockPrisma.task.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 4, title: 'Stale Task', assignedToId: 23,
        assignedTo: { name: 'Eve', manager: { id: 31, isActive: true } }
      }]);
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 100 }); // dup

    const result = await runDeadlineCheckJob();

    expect(result.skipped).toBe(1);
    expect(createNotification).not.toHaveBeenCalled();
  });

  // ─── Meeting reminder tests ─────────────────────────────────────────────────
  it('T8-08: meeting reminder sends to all attendees', async () => {
    mockPrisma.meeting.findMany.mockResolvedValue([{
      id: 5, title: 'Standup', status: 'Scheduled', isDeleted: false,
      attendees: [{ userId: 40 }, { userId: 41 }]
    }]);
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    const result = await runMeetingReminderJob();

    expect(result.processed).toBe(2);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'meeting_reminder', entityId: 5 })
    );
  });

  // ─── runAllJobs aggregation test ────────────────────────────────────────────
  it('T8-09: runAllJobs returns results for all 4 jobs', async () => {
    // All return empty datasets → 0 processed
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.meeting.findMany.mockResolvedValue([]);

    const results = await runAllJobs();

    expect(results).toHaveLength(4);
    expect(results.map(r => r.job)).toEqual([
      'daily_report_reminder', 'deadline_check', 'meeting_reminder', 'invoice_overdue'
    ]);
    results.forEach(r => { expect(r.errors).toBe(0); });
  });

  // ─── Invoice overdue (graceful when model absent) ───────────────────────────
  it('T8-10: invoice_overdue job gracefully skips when Invoice model not available', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 50 }]);

    const result = await runInvoiceOverdueJob();

    // Invoice model is not in Prisma yet (Sprint 10), so it skips gracefully
    expect(result.errors).toBe(0);
    expect(result.job).toBe('invoice_overdue');
  });
});
