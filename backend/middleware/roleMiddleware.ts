import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { roleMatches } from '../utils/rbac';

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roleMatches(req.user.role, roles)) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
      return;
    }
    next();
  };
};
