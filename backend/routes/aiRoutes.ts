import express from 'express';
import multer from 'multer';
import { parseTask } from '../controllers/aiController';
import { protect } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

// POST /api/ai/parse-task
// Requires an audio file in the 'audio' field
router.post(
  '/parse-task',
  protect,
  authorizeRoles('SuperAdmin', 'Manager', 'DevEmployee', 'MediaEmployee'),
  upload.single('audio'),
  parseTask
);

export default router;
