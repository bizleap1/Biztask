import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { initSentry, captureException } from './sentry';
initSentry();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
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
import trashRoutes from './routes/trashRoutes';
import prisma from './prismaClient';
import { apiLimiter } from './middleware/rateLimiters';
import { csrfProtection } from './middleware/authMiddleware';

const app = express();
const PORT = process.env.PORT || 5000;

// Respect reverse proxy headers from Render
app.set('trust proxy', 1);

// Security: Helmet for HTTP response headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Security: Whitelisted CORS with credentials support (allowing Vercel previews)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://biztask-omega.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('CORS origin rejected by security policy'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-setup-secret']
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Apply global rate limiting to all API routes
app.use('/api', apiLimiter as any);

// Apply CSRF protection for cookie-based state-changing requests
app.use('/api', csrfProtection);

// Health check endpoints for Render and monitors
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/readyz', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (error: any) {
    console.error('Readyz DB error details:', error.message || error);
    res.status(503).json({ status: 'not_ready', database: 'disconnected', error: error.message });
  }
});

// Legacy health routes
app.get('/', (req, res) => {
  res.send('BizLeap API is running');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BizLeap API is running' });
});

// Mount domain routes
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
app.use('/api/trash', trashRoutes);

// Global JSON error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  captureException(err);
  console.error('[Global Error]', err);
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal Server Error'
    : (err.message || 'Server error');

  res.status(status).json({
    error: {
      code: err.code || 'SERVER_ERROR',
      message,
      requestId: req.headers['x-request-id'] || undefined
    }
  });
});

let server: any;
if (require.main === module && !process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await prisma.$disconnect();
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  captureException(reason);
  console.error('Unhandled Rejection at:', reason);
  gracefulShutdown('unhandledRejection');
});
process.on('uncaughtException', (error) => {
  captureException(error);
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

export default app;
