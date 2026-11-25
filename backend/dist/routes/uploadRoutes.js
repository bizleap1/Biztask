"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const supabaseStorage_1 = require("../utils/supabaseStorage");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'video/mp4'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    }
});
router.post('/', authMiddleware_1.protect, upload.array('files'), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }
        const uploadPromises = files.map(file => (0, supabaseStorage_1.uploadFileToSupabase)(file.buffer, file.originalname, file.mimetype));
        const results = await Promise.all(uploadPromises);
        res.status(200).json({
            files: results.map((result, index) => ({
                url: result.url,
                path: result.path,
                fileName: files[index].originalname
            })),
            message: 'Files uploaded successfully'
        });
    }
    catch (error) {
        console.error('File Upload Error:', error);
        res.status(500).json({ message: error.message || 'Failed to upload files' });
    }
});
router.get('/signed-url', authMiddleware_1.protect, async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath || filePath.includes('..')) {
            return res.status(400).json({ message: 'Valid file path is required' });
        }
        const url = await (0, supabaseStorage_1.getSignedFileUrl)(filePath, 3600);
        res.json({ url });
    }
    catch (error) {
        console.error('Signed URL Error:', error);
        res.status(500).json({ message: 'Failed to generate signed URL' });
    }
});
exports.default = router;
