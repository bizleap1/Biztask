"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantPasswordReset = exports.deleteUser = exports.activateUser = exports.deactivateUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getUsers = exports.getDepartments = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const activityLogUtils_1 = require("../utils/activityLogUtils");
const notificationUtils_1 = require("../utils/notificationUtils");
const prismaClient_1 = __importDefault(require("../prismaClient"));
// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin, Manager
const getDepartments = async (req, res) => {
    try {
        const departments = await prismaClient_1.default.department.findMany();
        res.json(departments);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getDepartments = getDepartments;
// @desc    Get all users
const getUsers = async (req, res) => {
    try {
        let whereClause = {
            role: { not: 'SuperAdmin' }
        };
        const users = await prismaClient_1.default.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                departmentId: true,
                designation: true,
                isActive: true,
                createdAt: true,
                resetPasswordRequested: true,
                canResetPassword: true,
            },
        });
        res.status(200).json(users);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getUsers = getUsers;
// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/SuperAdmin, Manager (or self)
const getUserById = async (req, res) => {
    try {
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: Number(req.params.id) },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                departmentId: true,
                designation: true,
                isActive: true,
                createdAt: true,
                mustChangePassword: true,
                resetPasswordRequested: true,
                canResetPassword: true,
            },
        });
        if (user) {
            // Employees can only view their own profile
            if (req.user?.role !== 'SuperAdmin' && req.user?.role !== 'Manager' && req.user?.id !== user.id) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            res.json(user);
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getUserById = getUserById;
// @desc    Create a user
// @route   POST /api/users
// @access  Private/SuperAdmin, Manager
const createUser = async (req, res) => {
    try {
        const { name, email, password, role, departmentId, designation } = req.body;
        const userExists = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        if (role === 'SuperAdmin' && req.user?.role !== 'SuperAdmin') {
            return res.status(403).json({ message: 'Only SuperAdmin can create SuperAdmin accounts' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        let assignedDepartmentId = departmentId ? Number(departmentId) : null;
        if (!assignedDepartmentId) {
            if (role === 'DevEmployee')
                assignedDepartmentId = 1;
            else if (role === 'MediaEmployee')
                assignedDepartmentId = 2;
        }
        const user = await prismaClient_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                departmentId: assignedDepartmentId,
                designation,
                mustChangePassword: true,
                isActive: true,
            },
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'EMPLOYEE_CREATED',
            entityType: 'User',
            entityId: user.id,
            description: `Created employee: ${user.name}`,
            req
        });
        await (0, notificationUtils_1.createNotification)({
            userId: user.id,
            title: 'Account Created',
            message: 'Your BizLeap account has been created.',
            type: 'employee_created',
            entityType: 'User',
            entityId: user.id
        });
        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            designation: user.designation,
            isActive: user.isActive,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createUser = createUser;
// @desc    Update a user
// @route   PUT /api/users/:id
// @access  Private/SuperAdmin, Manager
const updateUser = async (req, res) => {
    try {
        const user = await prismaClient_1.default.user.findUnique({ where: { id: Number(req.params.id) } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.role === 'SuperAdmin' && req.user?.role !== 'SuperAdmin') {
            return res.status(403).json({ message: 'Only SuperAdmin can modify SuperAdmin accounts' });
        }
        const { name, role, departmentId, designation, isActive } = req.body;
        if (role === 'SuperAdmin' && req.user?.role !== 'SuperAdmin') {
            return res.status(403).json({ message: 'Only SuperAdmin can assign SuperAdmin role' });
        }
        let assignedDepartmentId = departmentId !== undefined ? (departmentId ? Number(departmentId) : null) : user.departmentId;
        // Auto-update department if role changed and no department explicitly passed
        if (departmentId === undefined && role && role !== user.role) {
            if (role === 'DevEmployee')
                assignedDepartmentId = 1;
            else if (role === 'MediaEmployee')
                assignedDepartmentId = 2;
        }
        const updatedUser = await prismaClient_1.default.user.update({
            where: { id: Number(req.params.id) },
            data: {
                name: name || user.name,
                role: role || user.role,
                departmentId: assignedDepartmentId,
                designation: designation !== undefined ? designation : user.designation,
                isActive: isActive !== undefined ? isActive : user.isActive,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                departmentId: true,
                designation: true,
                isActive: true,
            }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'EMPLOYEE_UPDATED',
            entityType: 'User',
            entityId: updatedUser.id,
            description: `Updated employee: ${updatedUser.name}`,
            req
        });
        res.json(updatedUser);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateUser = updateUser;
// @desc    Deactivate a user
// @route   PATCH /api/users/:id/deactivate
// @access  Private/SuperAdmin
const deactivateUser = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (req.user?.id === userId) {
            return res.status(400).json({ message: 'You cannot deactivate your own account' });
        }
        const userToDeactivate = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
        if (!userToDeactivate) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (userToDeactivate.role === 'SuperAdmin') {
            const superAdminCount = await prismaClient_1.default.user.count({ where: { role: 'SuperAdmin', isActive: true } });
            if (superAdminCount <= 1) {
                return res.status(400).json({ message: 'Cannot deactivate the last active SuperAdmin' });
            }
        }
        const updatedUser = await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { isActive: false },
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'EMPLOYEE_DEACTIVATED',
            entityType: 'User',
            entityId: updatedUser.id,
            description: `Deactivated employee ID ${updatedUser.id}`,
            req
        });
        await (0, notificationUtils_1.createNotification)({
            userId: updatedUser.id,
            title: 'Account Deactivated',
            message: 'Your BizLeap account has been deactivated.',
            type: 'employee_deactivated',
            entityType: 'User',
            entityId: updatedUser.id
        });
        res.json({ message: 'User deactivated successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deactivateUser = deactivateUser;
// @desc    Activate a user
// @route   PATCH /api/users/:id/activate
// @access  Private/SuperAdmin
const activateUser = async (req, res) => {
    try {
        const updatedUser = await prismaClient_1.default.user.update({
            where: { id: Number(req.params.id) },
            data: { isActive: true },
        });
        res.json({ message: 'User activated successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.activateUser = activateUser;
// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
const deleteUser = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (req.user?.id === userId) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }
        const userToDelete = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
        if (!userToDelete) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (userToDelete.role === 'SuperAdmin') {
            const superAdminCount = await prismaClient_1.default.user.count({ where: { role: 'SuperAdmin', isActive: true } });
            if (superAdminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last active SuperAdmin' });
            }
        }
        // Manual cascade delete for safety
        await prismaClient_1.default.taskSubmission.deleteMany({ where: { userId } });
        await prismaClient_1.default.taskSubmission.deleteMany({ where: { reviewedById: userId } });
        await prismaClient_1.default.comment.deleteMany({ where: { userId } });
        await prismaClient_1.default.notification.deleteMany({ where: { userId } });
        await prismaClient_1.default.activityLog.deleteMany({ where: { userId } });
        await prismaClient_1.default.dailyReport.deleteMany({ where: { userId } });
        await prismaClient_1.default.dailyReport.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });
        // Update tasks assigned TO this user to be Unassigned
        await prismaClient_1.default.task.updateMany({
            where: { assignedToId: userId },
            data: { assignedToId: null, status: 'Pending' }
        });
        // Delete tasks assigned BY this user (e.g. if manager is deleted, testing purposes)
        const tasksAssignedBy = await prismaClient_1.default.task.findMany({ where: { assignedById: userId } });
        for (const t of tasksAssignedBy) {
            await prismaClient_1.default.taskSubmission.deleteMany({ where: { taskId: t.id } });
            await prismaClient_1.default.task.delete({ where: { id: t.id } });
        }
        await prismaClient_1.default.user.delete({
            where: { id: userId }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'EMPLOYEE_REMOVED',
            entityType: 'User',
            entityId: userId,
            description: `Removed employee ID ${userId}`,
            req
        });
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteUser = deleteUser;
const grantPasswordReset = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await prismaClient_1.default.user.update({
            where: { id: userId },
            data: {
                canResetPassword: true,
                resetPasswordRequested: false
            }
        });
        await (0, notificationUtils_1.createNotification)({
            userId,
            title: 'Password Reset Approved',
            message: 'Admin has approved your password reset request. You can now reset your password on the login page.',
            type: 'system_alert',
            entityType: 'User',
            entityId: userId
        });
        res.json({ message: 'Password reset granted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.grantPasswordReset = grantPasswordReset;
