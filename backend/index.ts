import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import taskRoutes from './routes/taskRoutes';
import submissionRoutes from './routes/submissionRoutes';
import dailyReportRoutes from './routes/dailyReportRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import notificationRoutes from './routes/notificationRoutes';
import activityLogRoutes from './routes/activityLogRoutes';
import uploadRoutes from './routes/uploadRoutes';
import systemRoutes from './routes/systemRoutes';
import aiRoutes from './routes/aiRoutes';
import teamRoutes from './routes/teamRoutes';
import clientRoutes from './routes/clientRoutes';
import projectRoutes from './routes/projectRoutes';
import settingRoutes from './routes/settingRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import reminderRoutes from './routes/reminderRoutes';
import meetingRoutes from './routes/meetingRoutes';
import schedulerRoutes from './routes/schedulerRoutes';
import contentCalendarRoutes from './routes/contentCalendarRoutes';
import crmRoutes from './routes/crmRoutes';
import financeRoutes from './routes/financeRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import portalRoutes from './routes/portalRoutes';
import { startScheduler } from './workers/scheduler';

const app = express();
import prisma from './prismaClient';
const PORT = process.env.PORT || 5000;

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? frontendUrl : true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/request-reset', authLimiter);
app.use('/api/auth/execute-reset', authLimiter);

// Base health route
app.get('/', (req, res) => {
  res.send('BizLeap API is running');
});

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BizLeap API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/content-calendars', contentCalendarRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/portal', portalRoutes);

// Other routes will be added later

if (process.env.NODE_ENV !== 'test' && (process.env.NODE_ENV !== 'production' || !process.env.VERCEL)) {
  startScheduler();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
