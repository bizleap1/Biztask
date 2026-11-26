"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const dashboardController_1 = require("../controllers/dashboardController");
const router = express_1.default.Router();
router.get('/admin', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin'), dashboardController_1.getAdminDashboard);
router.get('/manager', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('Manager', 'TeamLead'), dashboardController_1.getManagerDashboard);
router.get('/employee', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('DevEmployee', 'MediaEmployee'), dashboardController_1.getEmployeeDashboard);
router.get('/hr', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('Viewer', 'SuperAdmin'), dashboardController_1.getHrDashboard);
exports.default = router;
