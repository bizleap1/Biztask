import express from 'express';
import { 
  getActivityLogs, 
  getMyActivityLogs,
  deleteActivityLog,
  bulkDeleteActivityLogs
} from '../controllers/activityLogController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

router.get('/my', protect, getMyActivityLogs as any);
router.get('/', protect, authorizeRoles('SuperAdmin', 'Manager', 'Viewer'), getActivityLogs as any);

router.delete('/bulk', protect, bulkDeleteActivityLogs as any);
router.delete('/:id', protect, deleteActivityLog as any);

export default router;
