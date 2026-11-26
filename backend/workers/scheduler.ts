/**
 * Sprint 8 — Cron Worker (node-cron)
 *
 * Registers all scheduled jobs. Only started when NODE_ENV !== 'test'
 * and when the server is running in a persistent process (non-Vercel).
 *
 * To swap for BullMQ + Redis (Render worker), replace the cron.schedule
 * calls with Queue.add() calls and move job logic to worker files.
 */

import cron from 'node-cron';
import {
  runDailyReportReminderJob,
  runDeadlineCheckJob,
  runMeetingReminderJob,
  runInvoiceOverdueJob
} from '../controllers/schedulerController';

export function startScheduler(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (process.env.DISABLE_SCHEDULER === 'true') return;

  console.log('[Scheduler] Starting cron jobs...');

  // Daily report reminder — every day at 7 PM server-local time
  cron.schedule('0 19 * * *', async () => {
    console.log('[Scheduler] Running daily report reminder job...');
    await runDailyReportReminderJob();
  });

  // Deadline & escalation check — every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running deadline check job...');
    await runDeadlineCheckJob();
  });

  // Meeting reminders — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Running meeting reminder job...');
    await runMeetingReminderJob();
  });

  // Invoice overdue — every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Scheduler] Running invoice overdue job...');
    await runInvoiceOverdueJob();
  });

  console.log('[Scheduler] All cron jobs registered.');
}
