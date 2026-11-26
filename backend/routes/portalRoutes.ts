import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import {
  getPortalOverview,
  getPortalTasks,
  getPortalTaskById,
  approvePortalTask,
  getPortalInvoices,
  getPortalReports,
  createPortalRequest,
  getPortalRequests,
  convertPortalRequest,
  getIntegrationStatus,
  previewPortalAsClient
} from '../controllers/portalController';

const router = express.Router();
router.get('/overview', protect, authorizeRoles('ClientUser'), getPortalOverview);
router.get('/tasks', protect, authorizeRoles('ClientUser'), getPortalTasks);
router.get('/tasks/:id', protect, authorizeRoles('ClientUser'), getPortalTaskById);
router.post('/tasks/:id/approval', protect, authorizeRoles('ClientUser'), approvePortalTask);
router.get('/invoices', protect, authorizeRoles('ClientUser'), getPortalInvoices);
router.get('/reports', protect, authorizeRoles('ClientUser'), getPortalReports);
router.get('/requests', protect, authorizeRoles('ClientUser'), getPortalRequests);
router.post('/requests', protect, authorizeRoles('ClientUser'), createPortalRequest);
router.post('/requests/:id/convert', protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead'), convertPortalRequest);
router.get('/integrations/status', protect, authorizeRoles('SuperAdmin', 'Manager'), getIntegrationStatus);
router.get('/preview/:clientId', protect, authorizeRoles('SuperAdmin', 'Manager', 'TeamLead'), previewPortalAsClient);

export default router;
