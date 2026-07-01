"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const activityLogController_1 = require("../controllers/activityLogController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const router = express_1.default.Router();
router.get('/my', authMiddleware_1.protect, activityLogController_1.getMyActivityLogs);
router.get('/', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager', 'Viewer'), activityLogController_1.getActivityLogs);
exports.default = router;
