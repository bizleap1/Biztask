import { Request, Response } from 'express';
import { AuthRequest, hashToken } from '../middleware/authMiddleware';
import { createNotification } from '../utils/notificationUtils';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createActivityLog } from '../utils/activityLogUtils';
import prisma from '../prismaClient';

const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_DAYS = 7;

const getAccessSecret = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'biztask_access_secret_fallback';
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || 'biztask_refresh_secret_fallback';

const generateTokens = (userId: number, sessionId: string) => {
  const accessToken = jwt.sign({ id: userId, sessionId }, getAccessSecret(), {
    expiresIn: ACCESS_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ id: userId, sessionId }, getRefreshSecret(), {
    expiresIn: `${REFRESH_EXPIRES_DAYS}d`,
  });

  return { accessToken, refreshToken };
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
  };

  // 15 minutes access cookie
  res.cookie('access_token', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });

  // 7 days refresh cookie
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  });

  // Backward compatibility alias for existing code
  res.cookie('token', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
};

const clearAuthCookies = (res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
  };

  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
  res.clearCookie('token', cookieOptions);
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null }
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      if (!user.isActive) {
        return res.status(401).json({ message: 'Your account is inactive. Please contact admin.' });
      }

      // Create session record in database
      const sessionId = crypto.randomUUID();
      const { accessToken, refreshToken } = generateTokens(user.id, sessionId);
      const refreshTokenHash = hashToken(refreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);

      await prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash,
          ipAddress: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
          expiresAt,
        }
      });

      // Set hardened httpOnly cookies
      setAuthCookies(res, accessToken, refreshToken);

      // Log activity
      createActivityLog({
        userId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        description: 'User logged in',
        req
      }).catch(err => console.error('Failed to create activity log:', err));

      // Return clean user DTO without password
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        designation: user.designation,
        status: user.isActive ? 'Active' : 'Inactive',
        mustChangePassword: user.mustChangePassword,
        token: accessToken, // for backward compatibility
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const refreshSession = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, getRefreshSecret());
    } catch (err) {
      clearAuthCookies(res);
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const currentHash = hashToken(refreshToken);
    const session = await prisma.session.findFirst({
      where: {
        id: decoded.sessionId,
        refreshTokenHash: currentHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true }
    });

    if (!session || !session.user || !session.user.isActive || session.user.deletedAt !== null) {
      clearAuthCookies(res);
      return res.status(401).json({ message: 'Session revoked or invalid' });
    }

    // Refresh rotation: generate new access and refresh tokens
    const newTokens = generateTokens(session.userId, session.id);
    const newHash = hashToken(newTokens.refreshToken);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newHash,
        lastUsedAt: new Date(),
      }
    });

    setAuthCookies(res, newTokens.accessToken, newTokens.refreshToken);

    res.json({
      message: 'Session refreshed',
      token: newTokens.accessToken,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        departmentId: session.user.departmentId,
      }
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ message: 'Failed to refresh session' });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (refreshToken) {
      const currentHash = hashToken(refreshToken);
      await prisma.session.updateMany({
        where: { refreshTokenHash: currentHash },
        data: { revokedAt: new Date() }
      });
    }

    if (req.sessionId) {
      await prisma.session.updateMany({
        where: { id: req.sessionId },
        data: { revokedAt: new Date() }
      });
    }

    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  }
};

export const logoutAllDevices = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    clearAuthCookies(res);

    await createActivityLog({
      userId,
      action: 'LOGOUT_ALL_DEVICES',
      entityType: 'User',
      entityId: userId,
      description: `${req.user!.name} logged out of all devices`,
      actorType: 'User',
      actorName: req.user!.name
    });

    res.json({ message: 'Logged out of all devices successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    clearAuthCookies(res);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({ user: req.user });
};

export const setup = async (req: Request, res: Response) => {
  try {
    const setupSecret = req.headers['x-setup-secret'];
    if (!setupSecret || setupSecret !== process.env.SETUP_SECRET) {
      return res.status(401).json({ message: 'Unauthorized setup request' });
    }

    const superAdminCount = await prisma.user.count({ where: { role: 'SuperAdmin', deletedAt: null } });
    if (superAdminCount > 0) {
      return res.status(400).json({ message: 'SuperAdmin already exists' });
    }

    const { name, email, password } = req.body;
    if (!password || password.length < 10) {
      return res.status(400).json({ message: 'Password must be at least 10 characters long' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'SuperAdmin',
      },
    });

    const sessionId = crypto.randomUUID();
    const { accessToken, refreshToken } = generateTokens(user.id, sessionId);

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
      }
    });

    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: accessToken,
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!newPassword || newPassword.length < 10) {
      return res.status(400).json({ message: 'New password must be at least 10 characters long' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false }
    });

    // Revoke other existing sessions upon password change for security
    await prisma.session.updateMany({
      where: { userId, id: { not: req.sessionId } },
      data: { revokedAt: new Date() }
    });

    await createActivityLog({
      userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      description: 'User changed password',
      req
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.canResetPassword) {
      return res.json({ alreadyGranted: true, message: 'You already have permission to reset your password. Please set your new password.' });
    }

    await prisma.user.update({
      where: { email },
      data: { resetPasswordRequested: true }
    });

    const admins = await prisma.user.findMany({
      where: { role: 'SuperAdmin', deletedAt: null }
    });

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        title: 'Password Reset Request',
        message: `${user.name} (${user.email}) requested a password reset.`,
        type: 'system_alert',
        entityType: 'User',
        entityId: user.id
      });
    }

    res.json({ message: 'Password reset request sent to admin.' });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const executePasswordReset = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;
    if (!newPassword || newPassword.length < 10) {
      return res.status(400).json({ message: 'New password must be at least 10 characters long' });
    }

    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.canResetPassword) {
      return res.status(403).json({ message: 'Password reset not approved by admin.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { email },
      data: { 
        password: hashedPassword, 
        canResetPassword: false, 
        resetPasswordRequested: false 
      }
    });

    // Revoke all existing sessions for this user
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    res.json({ message: 'Password updated successfully. Please log in.' });
  } catch (error) {
    console.error('Execute password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
