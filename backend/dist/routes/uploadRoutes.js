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
router.post('/', authMiddleware_1.protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const { url, path } = await (0, supabaseStorage_1.uploadFileToSupabase)(req.file.buffer, req.file.originalname, req.file.mimetype);
        res.status(200).json({
            url,
            path,
            fileName: req.file.originalname,
            message: 'File uploaded successfully'
        });
    }
    catch (error) {
        console.error('File Upload Error:', error);
        res.status(500).json({ message: error.message || 'Failed to upload file' });
    }
});
exports.default = router;
