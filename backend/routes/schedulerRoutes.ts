import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  runAllJobs,
  runDailyReportReminderJob,
  runDeadlineCheckJob,
  runMeetingReminderJob,
  runInvoiceOverdueJob
} from '../controllers/schedulerController';

const router = Router();

// @route   POST /api/scheduler/run
// @desc    Manually trigger all scheduled jobs (SuperAdmin only)
// @access  Private/SuperAdmin
router.post(
  '/run',
  protect,
  authorizeRoles('SuperAdmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const results = await runAllJobs();
      res.json({ message: 'All jobs executed', results });
    } catch (error) {
      console.error('Scheduler run error:', error);
      res.status(500).json({ message: 'Server error running scheduler jobs' });
    }
  }
);

// @route   POST /api/scheduler/run/:job
// @desc    Manually trigger a specific job (SuperAdmin only)
// @access  Private/SuperAdmin
router.post(
  '/run/:job',
  protect,
  authorizeRoles('SuperAdmin'),
  async (req: AuthRequest, res: Response) => {
    const jobName = Array.isArray(req.params.job) ? req.params.job[0] : req.params.job;
    const jobMap: Record<string, () => Promise<unknown>> = {
      'daily-report-reminder': runDailyReportReminderJob,
      'deadline-check': runDeadlineCheckJob,
      'meeting-reminder': runMeetingReminderJob,
      'invoice-overdue': runInvoiceOverdueJob
    };

    const fn = jobMap[jobName];
    if (!fn) {
      return res.status(400).json({
        message: `Unknown job "${jobName}". Valid: ${Object.keys(jobMap).join(', ')}`
      });
    }

    try {
      const result = await fn();
      res.json({ message: `Job "${jobName}" executed`, result });
    } catch (error) {
      console.error(`Scheduler job "${jobName}" error:`, error);
      res.status(500).json({ message: `Error running job "${jobName}"` });
    }
  }
);

// @route   GET /api/scheduler/jobs
// @desc    List available scheduled jobs (SuperAdmin only)
// @access  Private/SuperAdmin
router.get(
  '/jobs',
  protect,
  authorizeRoles('SuperAdmin'),
  (_req: AuthRequest, res: Response) => {
    res.json({
      jobs: [
        {
          id: 'daily-report-reminder',
          description: 'Reminds employees to submit daily reports',
          schedule: '0 19 * * * (7 PM daily)'
        },
        {
          id: 'deadline-check',
          description: 'Checks approaching/overdue task deadlines and escalates to managers',
          schedule: '0 * * * * (every hour)'
        },
        {
          id: 'meeting-reminder',
          description: 'Sends reminders for meetings starting within 2 hours',
          schedule: '*/30 * * * * (every 30 min)'
        },
        {
          id: 'invoice-overdue',
          description: 'Notifies admins about overdue invoices',
          schedule: '0 9 * * * (9 AM daily)'
        }
      ]
    });
  }
);

export default router;
