import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { checkIn, checkOut, getAttendance, importAttendance, requestLeave, getLeaveRequests, decideLeave } from '../controllers/attendanceController';

const router = express.Router();
router.post('/check-in', protect, checkIn);
router.post('/check-out', protect, checkOut);
router.get('/', protect, getAttendance);
router.post('/import', protect, authorizeRoles('SuperAdmin', 'Manager'), importAttendance);
router.post('/leave', protect, requestLeave);
router.get('/leave', protect, getLeaveRequests);
router.post('/leave/:id/decision', protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead'), decideLeave);
export default router;
