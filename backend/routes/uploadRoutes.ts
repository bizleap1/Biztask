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

router.post('/', protect, upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadPromises = files.map(file => 
      uploadFileToSupabase(file.buffer, file.originalname, file.mimetype)
    );

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      files: results.map((result, index) => ({
        url: result.url,
        path: result.path,
        fileName: files[index].originalname
      })),
      message: 'Files uploaded successfully'
    });
  } catch (error: any) {
    console.error('File Upload Error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload files' });
  }
});

export default router;
