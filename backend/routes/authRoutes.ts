import express from 'express';
import { 
  login, 
  setup, 
  changePassword, 
  requestPasswordReset, 
  executePasswordReset, 
  logout,
  logoutAllDevices,
  refreshSession,
  getMe
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { authLimiter, resetLimiter } from '../middleware/rateLimiters';
import { validateRequest } from '../middleware/validationMiddleware';
import { loginSchema, changePasswordSchema, requestResetSchema, executeResetSchema } from '../schemas';

const router = express.Router();

router.post('/login', validateRequest({ body: loginSchema }), authLimiter as any, login);
router.post('/refresh', refreshSession);
router.post('/setup', setup);
router.post('/logout', protect, logout as any);
router.post('/logout-all', protect, logoutAllDevices as any);
router.get('/me', protect, getMe as any);
router.post('/change-password', protect, validateRequest({ body: changePasswordSchema }), changePassword as any);
router.post('/request-reset', resetLimiter as any, validateRequest({ body: requestResetSchema }), requestPasswordReset as any);
router.post('/execute-reset', validateRequest({ body: executeResetSchema }), executePasswordReset as any);

export default router;
