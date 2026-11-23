import express from 'express';
import { 
  submitReport, 
  getAllReports, 
  getMyReports, 
  getReportById, 
  updateReport, 
  reviewReport, 
  markNeedsCorrection, 
  deleteReport,
  bulkDeleteReports
} from '../controllers/dailyReportController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { createReportSchema, reviewReportSchema } from '../schemas';

const router = express.Router();

// Base routes
router.route('/')
  .post(protect, authorizeRoles('DevEmployee', 'MediaEmployee', 'SuperAdmin', 'Manager'), validateRequest({ body: createReportSchema }), submitReport as any)
  .get(protect, authorizeRoles('SuperAdmin', 'Manager'), getAllReports as any);

router.get('/my', protect, getMyReports as any);

router.delete('/bulk', protect, bulkDeleteReports as any);

// Specific report routes
router.route('/:id')
  .get(protect, getReportById as any)
  .put(protect, authorizeRoles('DevEmployee', 'MediaEmployee', 'SuperAdmin', 'Manager'), updateReport as any)
  .delete(protect, deleteReport as any);

// Manager actions
router.patch('/:id/review', protect, authorizeRoles('SuperAdmin', 'Manager'), validateRequest({ body: reviewReportSchema }), reviewReport as any);
router.patch('/:id/needs-correction', protect, authorizeRoles('SuperAdmin', 'Manager'), markNeedsCorrection as any);

export default router;
