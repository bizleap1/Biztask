import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import {
  getAdminDashboard,
  getManagerDashboard,
  getEmployeeDashboard,
  getHrDashboard
} from '../controllers/dashboardController';

const router = express.Router();

router.get('/admin', protect, authorizeRoles('SuperAdmin'), getAdminDashboard as any);
router.get('/manager', protect, authorizeRoles('Manager', 'TeamLead'), getManagerDashboard as any);
router.get('/employee', protect, authorizeRoles('DevEmployee', 'MediaEmployee'), getEmployeeDashboard as any);
router.get('/hr', protect, authorizeRoles('Viewer', 'SuperAdmin'), getHrDashboard as any);

export default router;
