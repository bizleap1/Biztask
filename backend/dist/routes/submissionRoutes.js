"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const submissionController_1 = require("../controllers/submissionController");
const router = express_1.default.Router();
router.get('/pending', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), submissionController_1.getPendingSubmissions);
router.delete('/bulk', authMiddleware_1.protect, submissionController_1.bulkDeleteSubmissions);
router.delete('/:id', authMiddleware_1.protect, submissionController_1.deleteSubmission);
router.patch('/:id/approve', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), submissionController_1.approveSubmission);
router.patch('/:id/reject', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), submissionController_1.rejectSubmission);
exports.default = router;
