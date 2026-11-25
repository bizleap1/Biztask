"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post('/login', authController_1.login);
router.post('/google', authController_1.googleAuth);
router.post('/setup', authController_1.setup);
router.post('/logout', authController_1.logout);
router.post('/logout-all', authMiddleware_1.protect, authController_1.logoutAll);
router.get('/me', authMiddleware_1.protect, authController_1.getMe);
router.post('/change-password', authMiddleware_1.protect, authController_1.changePassword);
router.post('/request-reset', authController_1.requestPasswordReset);
router.post('/execute-reset', authController_1.executePasswordReset);
exports.default = router;
