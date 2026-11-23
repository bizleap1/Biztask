import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema } from '../schemas';
import {
  createTask,
  getTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  bulkDeleteTasks
} from '../controllers/taskController';
import { submitTask } from '../controllers/submissionController';

const router = express.Router();

// Routes for all authenticated users
router.get('/my', protect, getMyTasks as any);
router.get('/:id', protect, getTaskById as any);
router.patch('/:id/status', protect, validateRequest({ body: updateTaskStatusSchema }), updateTaskStatus as any);
router.post('/:id/submit', protect, submitTask as any);
router.delete('/bulk', protect, bulkDeleteTasks as any);

// Routes for SuperAdmin and Manager
router.route('/')
  .get(protect, getTasks as any)
  .post(protect, authorizeRoles('SuperAdmin', 'Manager', 'DevEmployee', 'MediaEmployee'), validateRequest({ body: createTaskSchema }), createTask as any);

router.route('/:id')
  .put(protect, authorizeRoles('SuperAdmin', 'Manager', 'DevEmployee', 'MediaEmployee'), validateRequest({ body: updateTaskSchema }), updateTask as any)
  .delete(protect, authorizeRoles('SuperAdmin', 'Manager', 'DevEmployee', 'MediaEmployee'), deleteTask as any);

export default router;
