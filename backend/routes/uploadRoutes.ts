import express from 'express';
import multer from 'multer';
import { uploadFileToSupabase } from '../utils/supabaseStorage';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { url, path } = await uploadFileToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);

    res.status(200).json({
      url,
      path,
      fileName: req.file.originalname,
      message: 'File uploaded successfully'
    });
  } catch (error: any) {
    console.error('File Upload Error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload file' });
  }
});

export default router;
