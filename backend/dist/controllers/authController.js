"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executePasswordReset = exports.requestPasswordReset = exports.changePassword = exports.setup = exports.login = void 0;
const notificationUtils_1 = require("../utils/notificationUtils");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const activityLogUtils_1 = require("../utils/activityLogUtils");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '30d',
    });
};
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (user && (await bcryptjs_1.default.compare(password, user.password))) {
            if (!user.isActive) {
                return res.status(401).json({ message: 'Your account is inactive. Please contact admin.' });
            }
            (0, activityLogUtils_1.createActivityLog)({
                userId: user.id,
                action: 'LOGIN',
                entityType: 'User',
                entityId: user.id,
                description: 'User logged in',
                req
            }).catch(err => console.error('Failed to create activity log:', err));
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                departmentId: user.departmentId,
                designation: user.designation,
                status: user.isActive ? 'Active' : 'Inactive',
                mustChangePassword: user.mustChangePassword,
                token: generateToken(user.id),
            });
        }
        else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.login = login;
// Setup initial admin if no users exist
const setup = async (req, res) => {
    try {
        const setupSecret = req.headers['x-setup-secret'];
        if (!setupSecret || setupSecret !== process.env.SETUP_SECRET) {
            return res.status(401).json({ message: 'Unauthorized setup request' });
        }
        const superAdminCount = await prismaClient_1.default.user.count({ where: { role: 'SuperAdmin' } });
        if (superAdminCount > 0) {
            return res.status(400).json({ message: 'SuperAdmin already exists' });
        }
        const { name, email, password } = req.body;
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const user = await prismaClient_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'SuperAdmin',
            },
        });
        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.setup = setup;
const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        const user = await prismaClient_1.default.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isMatch = await bcryptjs_1.default.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect old password' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, salt);
        await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { password: hashedPassword, mustChangePassword: false }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId,
            action: 'PASSWORD_CHANGED',
            entityType: 'User',
            entityId: userId,
            description: 'User changed password',
            req
        });
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.changePassword = changePassword;
const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.canResetPassword) {
            return res.json({ alreadyGranted: true, message: 'You already have permission to reset your password. Please set your new password.' });
        }
        await prismaClient_1.default.user.update({
            where: { email },
            data: { resetPasswordRequested: true }
        });
        const admins = await prismaClient_1.default.user.findMany({
            where: { role: 'SuperAdmin' }
        });
        for (const admin of admins) {
            await (0, notificationUtils_1.createNotification)({
                userId: admin.id,
                title: 'Password Reset Request',
                message: `${user.name} (${user.email}) requested a password reset.`,
                type: 'system_alert',
                entityType: 'User',
                entityId: user.id
            });
        }
        res.json({ message: 'Password reset request sent to admin.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.requestPasswordReset = requestPasswordReset;
const executePasswordReset = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const user = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!user.canResetPassword) {
            return res.status(403).json({ message: 'Password reset not approved by admin.' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await prismaClient_1.default.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                canResetPassword: false,
                resetPasswordRequested: false
            }
        });
        res.json({ message: 'Password updated successfully.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.executePasswordReset = executePasswordReset;
