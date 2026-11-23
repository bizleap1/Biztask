import express from 'express';
import { getTrash, restoreItem } from '../controllers/trashController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

router.get('/', protect, authorizeRoles('SuperAdmin') as any, getTrash as any);
router.post('/restore', protect, authorizeRoles('SuperAdmin') as any, restoreItem as any);

export default router;
