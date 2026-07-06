import express from 'express';
import { clearAllData } from '../controllers/systemController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

// Only SuperAdmin can clear all data
router.delete('/clear-data', protect, authorizeRoles('SuperAdmin') as any, clearAllData as any);

export default router;
