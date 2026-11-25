"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = void 0;
const rbac_1 = require("../utils/rbac");
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !(0, rbac_1.roleMatches)(req.user.role, roles)) {
            res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
            return;
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
