import express from 'express';
import { getSettings, upsertSettings } from '../controllers/settingController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();

router.route('/')
  .get(protect, authorizeRoles('SuperAdmin', 'Manager'), getSettings as any)
  .put(protect, authorizeRoles('SuperAdmin'), upsertSettings as any);

export default router;
