import express from 'express';
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deactivateUser, 
  activateUser,
  deleteUser,
  grantPasswordReset,
  getDepartments
} from '../controllers/userController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

router.get('/departments', protect, getDepartments as any);

router.route('/')
  .get(protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead', 'Employee', 'DevEmployee', 'MediaEmployee'), getUsers as any)
  .post(protect, authorizeRoles('SuperAdmin', 'Manager'), createUser as any);

router.route('/:id')
  .get(protect, getUserById as any)
  .put(protect, authorizeRoles('SuperAdmin', 'Manager'), updateUser as any)
  .delete(protect, authorizeRoles('SuperAdmin'), deleteUser as any);

router.patch('/:id/deactivate', protect, authorizeRoles('SuperAdmin'), deactivateUser as any);
router.patch('/:id/activate', protect, authorizeRoles('SuperAdmin'), activateUser as any);
router.patch('/:id/grant-reset', protect, authorizeRoles('SuperAdmin'), grantPasswordReset as any);

export default router;
