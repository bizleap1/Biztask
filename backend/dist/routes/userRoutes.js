"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const roleMiddleware_1 = require("../middleware/roleMiddleware");
const router = express_1.default.Router();
router.get('/departments', authMiddleware_1.protect, userController_1.getDepartments);
router.post('/departments', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), userController_1.createDepartment);
router.put('/departments/:id', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), userController_1.updateDepartment);
router.delete('/departments/:id', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin'), userController_1.deleteDepartment);
router.route('/')
    .get(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager', 'TeamLead', 'Employee', 'DevEmployee', 'MediaEmployee'), userController_1.getUsers)
    .post(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), userController_1.createUser);
router.route('/:id')
    .get(authMiddleware_1.protect, userController_1.getUserById)
    .put(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin', 'Manager'), userController_1.updateUser)
    .delete(authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin'), userController_1.deleteUser);
router.patch('/:id/deactivate', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin'), userController_1.deactivateUser);
router.patch('/:id/activate', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin'), userController_1.activateUser);
router.patch('/:id/grant-reset', authMiddleware_1.protect, (0, roleMiddleware_1.authorizeRoles)('SuperAdmin'), userController_1.grantPasswordReset);
exports.default = router;
