"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = exports.getJwtSecret = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = __importDefault(require("../prismaClient"));
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not configured');
    }
    return secret;
};
exports.getJwtSecret = getJwtSecret;
const protect = async (req, res, next) => {
    let token = req.cookies?.token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, (0, exports.getJwtSecret)(), { algorithms: ['HS256'] });
            const user = await prismaClient_1.default.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    departmentId: true,
                    isActive: true,
                    mustChangePassword: true,
                    tokenVersion: true,
                },
            });
            if (!user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            if (!user.isActive) {
                return res.status(401).json({ message: 'Not authorized, account is inactive' });
            }
            if (typeof decoded.tv === 'number' && decoded.tv !== user.tokenVersion) {
                return res.status(401).json({ message: 'Session has been invalidated. Please log in again.' });
            }
            const allowedWhileMustChange = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/me'];
            if (user.mustChangePassword && !allowedWhileMustChange.includes(req.originalUrl.split('?')[0])) {
                return res.status(403).json({
                    message: 'Password change required before accessing this resource',
                    mustChangePassword: true,
                });
            }
            req.user = user;
            next();
        }
        catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};
exports.protect = protect;
