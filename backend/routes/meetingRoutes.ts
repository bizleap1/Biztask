import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  saveMeetingMinutes,
  createMeetingActionItem,
  convertMeetingActionItemToTask
} from '../controllers/meetingController';

const router = express.Router();
const managers = ['SuperAdmin', 'Manager', 'TeamLead'] as const;

router.get('/', protect, getMeetings as any);
router.get('/:id', protect, getMeetingById as any);
router.post('/', protect, authorizeRoles(...managers), createMeeting as any);
router.put('/:id', protect, authorizeRoles(...managers), updateMeeting as any);
router.post('/:id/minutes', protect, authorizeRoles(...managers), saveMeetingMinutes as any);
router.post('/:id/action-items', protect, authorizeRoles(...managers), createMeetingActionItem as any);
router.post('/:id/action-items/:itemId/convert', protect, authorizeRoles(...managers), convertMeetingActionItemToTask as any);

export default router;
