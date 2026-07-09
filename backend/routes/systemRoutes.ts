import express from 'express';
import { clearAllData, flushOldData } from '../controllers/systemController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

// Only SuperAdmin can clear all data
router.delete('/clear-data', protect, authorizeRoles('SuperAdmin') as any, clearAllData as any);

// SuperAdmin can flush old logs/notifications
router.delete('/flush-data', protect, authorizeRoles('SuperAdmin') as any, flushOldData as any);

export default router;
