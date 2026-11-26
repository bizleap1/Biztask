import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import {
  getUnifiedReminders,
  getReminderTemplates,
  buildWhatsAppLink,
  buildEmailDraft,
} from '../controllers/reminderController';

const router = express.Router();

const STAFF_ROLES = ['SuperAdmin', 'Manager', 'TeamLead', 'Employee'];

router.get('/', protect, authorizeRoles(...STAFF_ROLES), getUnifiedReminders);
router.get('/templates', protect, authorizeRoles(...STAFF_ROLES), getReminderTemplates);
router.post('/whatsapp-link', protect, authorizeRoles(...STAFF_ROLES), buildWhatsAppLink);
router.post('/email-draft', protect, authorizeRoles(...STAFF_ROLES), buildEmailDraft);

export default router;
