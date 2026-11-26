import express from 'express';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  addClientContact,
  deleteClientContact,
} from '../controllers/clientController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead', 'Employee'), getClients as any)
  .post(protect, authorizeRoles('SuperAdmin', 'Manager'), createClient as any);

router.route('/:id')
  .get(protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead', 'Employee'), getClientById as any)
  .put(protect, authorizeRoles('SuperAdmin', 'Manager'), updateClient as any)
  .delete(protect, authorizeRoles('SuperAdmin', 'Manager'), deleteClient as any);

router.post('/:id/contacts', protect, authorizeRoles('SuperAdmin', 'Manager'), addClientContact as any);
router.delete('/:id/contacts/:contactId', protect, authorizeRoles('SuperAdmin', 'Manager'), deleteClientContact as any);

export default router;
