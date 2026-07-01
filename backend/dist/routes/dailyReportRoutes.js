"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dailyReportController_1 = require("../controllers/dailyReportController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const router = express_1.default.Router();
// Base routes
router.route('/')
    .post(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('DevEmployee', 'MediaEmployee', 'SuperAdmin', 'Manager'), dailyReportController_1.submitReport)
    .get(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), dailyReportController_1.getAllReports);
router.get('/my', authMiddleware_1.protect, dailyReportController_1.getMyReports);
// Specific report routes
router.route('/:id')
    .get(authMiddleware_1.protect, dailyReportController_1.getReportById)
    .put(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('DevEmployee', 'MediaEmployee', 'SuperAdmin', 'Manager'), dailyReportController_1.updateReport)
    .delete(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin'), dailyReportController_1.deleteReport);
// Manager actions
router.patch('/:id/review', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), dailyReportController_1.reviewReport);
router.patch('/:id/needs-correction', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), dailyReportController_1.markNeedsCorrection);
exports.default = router;
