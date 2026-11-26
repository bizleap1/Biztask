import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { getPortalOverview, getPortalTasks, getPortalTaskById } from '../controllers/portalController';

const router = express.Router();
router.get('/overview', protect, authorizeRoles('ClientUser'), getPortalOverview);
router.get('/tasks', protect, authorizeRoles('ClientUser'), getPortalTasks);
router.get('/tasks/:id', protect, authorizeRoles('ClientUser'), getPortalTaskById);

export default router;
