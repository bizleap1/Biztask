import express from 'express';
import { login, setup, changePassword } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', login);
router.post('/setup', setup);
router.post('/change-password', protect, changePassword as any);

export default router;
