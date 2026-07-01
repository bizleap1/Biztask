import express from 'express';
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  checkDeadlines
} from '../controllers/notificationController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

router.get('/', protect, getNotifications as any);
router.get('/unread-count', protect, getUnreadCount as any);
router.patch('/read-all', protect, markAllAsRead as any);
router.patch('/:id/read', protect, markAsRead as any);
router.delete('/:id', protect, deleteNotification as any);

router.post('/check-deadlines', protect, authorizeRoles('SuperAdmin', 'Manager'), checkDeadlines as any);

export default router;
