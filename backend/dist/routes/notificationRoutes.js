"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationController_1 = require("../controllers/notificationController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const router = express_1.default.Router();
router.get('/', authMiddleware_1.protect, notificationController_1.getNotifications);
router.get('/unread-count', authMiddleware_1.protect, notificationController_1.getUnreadCount);
router.patch('/read-all', authMiddleware_1.protect, notificationController_1.markAllAsRead);
router.patch('/:id/read', authMiddleware_1.protect, notificationController_1.markAsRead);
router.delete('/:id', authMiddleware_1.protect, notificationController_1.deleteNotification);
router.post('/check-deadlines', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), notificationController_1.checkDeadlines);
exports.default = router;
