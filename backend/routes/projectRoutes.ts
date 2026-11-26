import express from 'express';
import { getProjects, createProject, updateProject, deleteProject } from '../controllers/projectController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead', 'Employee'), getProjects as any)
  .post(protect, authorizeRoles('SuperAdmin', 'Manager'), createProject as any);

router.route('/:id')
  .put(protect, authorizeRoles('SuperAdmin', 'Manager'), updateProject as any)
  .delete(protect, authorizeRoles('SuperAdmin', 'Manager'), deleteProject as any);

export default router;
