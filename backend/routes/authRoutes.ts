import express from 'express';
import { login, setup, changePassword, requestPasswordReset, executePasswordReset, logout, googleAuth, getMe, logoutAll } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', login);
router.post('/google', googleAuth);
router.post('/setup', setup);
router.post('/logout', logout as any);
router.post('/logout-all', protect, logoutAll as any);
router.get('/me', protect, getMe as any);
router.post('/change-password', protect, changePassword as any);
router.post('/request-reset', requestPasswordReset as any);
router.post('/execute-reset', executePasswordReset as any);

export default router;
