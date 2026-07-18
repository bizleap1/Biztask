import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

const app = express();
import prisma from './prismaClient';
const PORT = process.env.PORT || 5000;

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? frontendUrl : true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

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

// Other routes will be added later

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
