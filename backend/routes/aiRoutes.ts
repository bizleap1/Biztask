import express from 'express';
import multer from 'multer';
import { parseTask } from '../controllers/aiController';
import { protect } from '../middleware/authMiddleware'; // Ensure the route is protected

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/ai/parse-task
// Requires an audio file in the 'audio' field
router.post('/parse-task', protect, upload.single('audio'), parseTask);

export default router;
