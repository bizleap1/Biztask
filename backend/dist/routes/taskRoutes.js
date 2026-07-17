"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const taskController_1 = require("../controllers/taskController");
const submissionController_1 = require("../controllers/submissionController");
const router = express_1.default.Router();
// Routes for all authenticated users
router.get('/my', authMiddleware_1.protect, taskController_1.getMyTasks);
router.get('/:id', authMiddleware_1.protect, taskController_1.getTaskById);
router.patch('/:id/status', authMiddleware_1.protect, taskController_1.updateTaskStatus);
router.post('/:id/submit', authMiddleware_1.protect, submissionController_1.submitTask);
router.delete('/bulk', authMiddleware_1.protect, taskController_1.bulkDeleteTasks);
// Routes for SuperAdmin and Manager
router.route('/')
    .get(authMiddleware_1.protect, taskController_1.getTasks)
    .post(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager', 'DevEmployee', 'MediaEmployee'), taskController_1.createTask);
router.route('/:id')
    .put(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager', 'DevEmployee', 'MediaEmployee'), taskController_1.updateTask)
    .delete(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager', 'DevEmployee', 'MediaEmployee'), taskController_1.deleteTask);
exports.default = router;
