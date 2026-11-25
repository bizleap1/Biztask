import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import prisma from '../prismaClient';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
    departmentId: number | null;
    isActive: boolean;
    mustChangePassword: boolean;
    tokenVersion: number;
  };
}

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  return secret;
};

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token = req.cookies?.token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded: any = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

      const user = await prisma.user.findUnique({
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
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};
