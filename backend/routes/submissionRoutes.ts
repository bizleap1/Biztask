import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import {
  submitTask,
  approveSubmission,
  rejectSubmission,
  getPendingSubmissions
} from '../controllers/submissionController';

const router = express.Router();

router.get('/pending', protect, authorizeRoles('SuperAdmin', 'Manager'), getPendingSubmissions as any);

router.patch('/:id/approve', protect, authorizeRoles('SuperAdmin', 'Manager'), approveSubmission as any);
router.patch('/:id/reject', protect, authorizeRoles('SuperAdmin', 'Manager'), rejectSubmission as any);

export default router;
