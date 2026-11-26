import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { getLeads, getLeadById, createLead, updateLead, addLeadActivity, convertLead } from '../controllers/crmController';

const router = express.Router();
const salesRoles = ['SuperAdmin', 'Manager', 'TeamLead', 'Employee'];

router.get('/leads', protect, authorizeRoles(...salesRoles), getLeads as any);
router.post('/leads', protect, authorizeRoles(...salesRoles), createLead as any);
router.get('/leads/:id', protect, authorizeRoles(...salesRoles), getLeadById as any);
router.put('/leads/:id', protect, authorizeRoles(...salesRoles), updateLead as any);
router.post('/leads/:id/activities', protect, authorizeRoles(...salesRoles), addLeadActivity as any);
router.post('/leads/:id/convert', protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead'), convertLead as any);

export default router;
