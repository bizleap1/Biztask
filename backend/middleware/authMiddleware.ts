import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../prismaClient';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  departmentId: number | null;
  designation?: string | null;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  sessionId?: string;
}

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const hasAuthHeader = req.headers.authorization && req.headers.authorization.startsWith('Bearer');
  const customHeader = req.headers['x-requested-with'];

  if (isStateChanging && !hasAuthHeader) {
    if (!customHeader || customHeader !== 'XMLHttpRequest') {
      res.status(403).json({
        error: {
          code: 'CSRF_PROTECTION_FAILED',
          message: 'Missing or invalid CSRF protection header (X-Requested-With: XMLHttpRequest required).'
        }
      });
      return;
    }
  }
  next();
};

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // 1. CSRF Protection for state-changing requests using cookie auth
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const hasAuthHeader = req.headers.authorization && req.headers.authorization.startsWith('Bearer');
  const customHeader = req.headers['x-requested-with'];

  if (isStateChanging && !hasAuthHeader) {
    if (!customHeader || customHeader !== 'XMLHttpRequest') {
      res.status(403).json({
        error: {
          code: 'CSRF_PROTECTION_FAILED',
          message: 'Missing or invalid CSRF protection header (X-Requested-With: XMLHttpRequest required).'
        }
      });
      return;
    }
  }

  // 2. Extract access token from cookies or Authorization header
  let token = req.cookies.access_token || req.cookies.token;
  if (hasAuthHeader) {
    token = req.headers.authorization!.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. No active session found.'
      }
    });
    return;
  }

  try {
    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'biztask_access_secret_fallback';
    const decoded = jwt.verify(token, accessSecret) as { id: number; sessionId?: string };

    const user = await prisma.user.findFirst({
      where: {
        id: decoded.id,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        designation: true,
        isActive: true
      }
    });

    if (!user) {
      res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account no longer exists.'
        }
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'User account is deactivated. Please contact an administrator.'
        }
      });
      return;
    }

    req.user = user;
    if (decoded.sessionId) {
      req.sessionId = decoded.sessionId;
    }

    next();
  } catch (error: any) {
    // If token expired, advise client to refresh
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired. Please refresh your session.'
        }
      });
      return;
    }

    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid session token.'
      }
    });
  }
};
