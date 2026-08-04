import express from 'express';
import multer from 'multer';
import { parseTask, generateCalendar } from '../controllers/aiController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/parse-task', protect, upload.single('audio'), parseTask);
router.post('/generate-calendar', protect, generateCalendar);

export default router;
