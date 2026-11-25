"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.logoutAll = exports.getMe = exports.googleAuth = exports.executePasswordReset = exports.requestPasswordReset = exports.changePassword = exports.setup = exports.login = void 0;
const crypto_1 = __importDefault(require("crypto"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const notificationUtils_1 = require("../utils/notificationUtils");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const activityLogUtils_1 = require("../utils/activityLogUtils");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(1, 'Old password is required'),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters'),
});
const emailSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email is required'),
});
const executeResetSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email is required'),
    resetCode: zod_1.z.string().min(4, 'Reset code is required'),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters'),
});
const googleAuthSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(10, 'Google ID token is required'),
});
const hashResetCode = (code) => crypto_1.default.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
const generateToken = (id, tokenVersion = 0) => {
    return jsonwebtoken_1.default.sign({ id, tv: tokenVersion }, (0, authMiddleware_1.getJwtSecret)(), {
        expiresIn: '30d',
    });
};
const login = async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
        }
        const { email, password } = parsed.data;
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
            const token = generateToken(user.id, user.tokenVersion ?? 0);
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                departmentId: user.departmentId,
                designation: user.designation,
                status: user.isActive ? 'Active' : 'Inactive',
                mustChangePassword: user.mustChangePassword,
                token: token,
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
        const token = generateToken(user.id, user.tokenVersion ?? 0);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: token,
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
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
        }
        const { oldPassword, newPassword } = parsed.data;
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
            data: { password: hashedPassword, mustChangePassword: false, tokenVersion: { increment: 1 } }
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
        const parsed = emailSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid email' });
        }
        const { email } = parsed.data;
        const user = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({ message: 'If an account with that email exists, a password reset request has been sent to the administrator.' });
        }
        if (user.canResetPassword) {
            return res.json({ alreadyGranted: true, message: 'You already have permission to reset your password. Please set your new password.' });
        }
        await prismaClient_1.default.user.update({
            where: { email },
            data: { resetPasswordRequested: true }
        });
        const admins = await prismaClient_1.default.user.findMany({
            where: { role: 'SuperAdmin', isActive: true }
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
        const parsed = executeResetSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
        }
        const { email, resetCode, newPassword } = parsed.data;
        const user = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (!user || !user.canResetPassword || !user.resetTokenHash || !user.resetTokenExpiresAt) {
            return res.status(403).json({ message: 'Invalid or unapproved password reset request.' });
        }
        if (user.resetTokenExpiresAt.getTime() < Date.now()) {
            return res.status(403).json({ message: 'Password reset code has expired. Please request a new one.' });
        }
        const providedHash = Buffer.from(hashResetCode(resetCode), 'hex');
        const storedHash = Buffer.from(user.resetTokenHash, 'hex');
        if (providedHash.length !== storedHash.length || !crypto_1.default.timingSafeEqual(providedHash, storedHash)) {
            return res.status(403).json({ message: 'Invalid password reset code.' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await prismaClient_1.default.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                canResetPassword: false,
                resetPasswordRequested: false,
                resetTokenHash: null,
                resetTokenExpiresAt: null,
                mustChangePassword: false,
                tokenVersion: { increment: 1 }
            }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: user.id,
            action: 'PASSWORD_RESET',
            entityType: 'User',
            entityId: user.id,
            description: 'User completed admin-approved password reset',
            req
        });
        res.json({ message: 'Password updated successfully.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.executePasswordReset = executePasswordReset;
const googleAuth = async (req, res) => {
    try {
        const parsed = googleAuthSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid Google token' });
        }
        const { idToken } = parsed.data;
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        if (!verifyRes.ok) {
            return res.status(401).json({ message: 'Invalid Google ID token' });
        }
        const payload = await verifyRes.json();
        const expectedClientId = process.env.GOOGLE_CLIENT_ID;
        if (expectedClientId && payload.aud !== expectedClientId) {
            return res.status(401).json({ message: 'Google token audience mismatch' });
        }
        if (payload.email_verified !== 'true' && payload.email_verified !== true) {
            return res.status(401).json({ message: 'Google email is not verified' });
        }
        const user = await prismaClient_1.default.user.findUnique({ where: { email: payload.email } });
        if (!user) {
            return res.status(401).json({ message: 'No BizTask account found for this Google email' });
        }
        if (!user.isActive) {
            return res.status(401).json({ message: 'Your account is inactive. Please contact admin.' });
        }
        if (!user.googleId || (!user.avatarUrl && payload.picture)) {
            await prismaClient_1.default.user.update({
                where: { id: user.id },
                data: {
                    googleId: user.googleId || payload.sub,
                    avatarUrl: user.avatarUrl || payload.picture || null,
                },
            });
        }
        (0, activityLogUtils_1.createActivityLog)({
            userId: user.id,
            action: 'LOGIN_GOOGLE',
            entityType: 'User',
            entityId: user.id,
            description: 'User logged in via Google',
            req,
        }).catch(err => console.error('Failed to create activity log:', err));
        const token = generateToken(user.id, user.tokenVersion ?? 0);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId,
            designation: user.designation,
            status: user.isActive ? 'Active' : 'Inactive',
            mustChangePassword: user.mustChangePassword,
            token,
        });
    }
    catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.googleAuth = googleAuth;
const getMe = async (req, res) => {
    try {
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                departmentId: true,
                designation: true,
                phone: true,
                whatsappNumber: true,
                avatarUrl: true,
                isActive: true,
                mustChangePassword: true,
                department: { select: { id: true, name: true } },
                teamMemberships: {
                    include: { team: { select: { id: true, name: true, departmentId: true } } },
                },
                clientMemberships: {
                    where: { isRevoked: false },
                    include: { client: { select: { id: true, name: true, companyName: true } } },
                },
            },
        });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        res.json(user);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMe = getMe;
const logoutAll = async (req, res) => {
    try {
        await prismaClient_1.default.user.update({
            where: { id: req.user.id },
            data: { tokenVersion: { increment: 1 } },
        });
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });
        res.json({ message: 'All sessions have been invalidated' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.logoutAll = logoutAll;
const logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.json({ message: 'Logged out successfully' });
};
exports.logout = logout;
