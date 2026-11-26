import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import {
  getOverview,
  getTaskMetrics,
  getUserActivity,
} from '../controllers/analyticsController';

const router = express.Router();

router.get('/overview', protect, authorizeRoles('SuperAdmin', 'Manager'), getOverview);
router.get('/tasks', protect, authorizeRoles('SuperAdmin', 'Manager'), getTaskMetrics);
router.get('/users', protect, authorizeRoles('SuperAdmin', 'Manager'), getUserActivity);

export default router;
