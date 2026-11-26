import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import {
  getCalendars,
  getCalendarById,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  addItem,
  updateItem,
  deleteItem,
  approveItem,
  rejectItem,
  convertToTask,
  generateItems,
  exportCalendar
} from '../controllers/contentCalendarController';

const router = Router();

const managerUp = ['SuperAdmin', 'Manager', 'TeamLead'];
const allStaff = ['SuperAdmin', 'Manager', 'TeamLead', 'Employee'];

// Calendar CRUD
router.get('/', protect, authorizeRoles(...allStaff), getCalendars);
router.get('/:id', protect, authorizeRoles(...allStaff), getCalendarById);
router.post('/', protect, authorizeRoles(...managerUp), createCalendar);
router.put('/:id', protect, authorizeRoles(...managerUp), updateCalendar);
router.delete('/:id', protect, authorizeRoles(...managerUp), deleteCalendar);

// Items
router.post('/:id/items', protect, authorizeRoles(...allStaff), addItem);
router.put('/:calId/items/:itemId', protect, authorizeRoles(...allStaff), updateItem);
router.delete('/:calId/items/:itemId', protect, authorizeRoles(...managerUp), deleteItem);

// Review gate
router.patch('/:calId/items/:itemId/approve', protect, authorizeRoles(...managerUp), approveItem);
router.patch('/:calId/items/:itemId/reject', protect, authorizeRoles(...managerUp), rejectItem);

// Convert to task
router.post('/:calId/items/:itemId/convert-to-task', protect, authorizeRoles(...managerUp), convertToTask);

// AI generate
router.post('/:id/generate', protect, authorizeRoles(...managerUp), generateItems);

// Export
router.get('/:id/export', protect, authorizeRoles(...allStaff), exportCalendar);

export default router;
