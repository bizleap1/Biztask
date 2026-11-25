import { Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createActivityLog } from '../utils/activityLogUtils';
import { createNotification } from '../utils/notificationUtils';
import { AuthRequest } from '../middleware/authMiddleware';
import { canGrantRole } from '../utils/rbac';

import prisma from '../prismaClient';

// @desc    Get all users
// @route   GET /api/users
// @access  Private/SuperAdmin, Manager
export const getDepartments = async (req: AuthRequest, res: Response) => {
  try {
    const departments = await prisma.department.findMany();
    res.json(departments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const isAdminOrManager = req.user?.role === 'SuperAdmin' || req.user?.role === 'Manager';
    const whereClause: any = {
      role: { not: 'SuperAdmin' }
    };

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: isAdminOrManager,
        role: true,
        departmentId: true,
        designation: true,
        isActive: true,
        createdAt: isAdminOrManager,
        resetPasswordRequested: isAdminOrManager,
        canResetPassword: isAdminOrManager,
      },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/SuperAdmin, Manager (or self)
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
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
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a user
// @route   POST /api/users
// @access  Private/SuperAdmin, Manager
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, departmentId, designation } = req.body;

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    if (!canGrantRole(req.user!.role, role)) {
      return res.status(403).json({ message: `Role '${req.user!.role}' is not permitted to create '${role}' accounts` });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let assignedDepartmentId = departmentId ? Number(departmentId) : null;
    if (!assignedDepartmentId) {
      const deptName = role === 'DevEmployee' ? 'Development' : role === 'MediaEmployee' ? 'Media' : null;
      if (deptName) {
        const dept = await prisma.department.findUnique({ where: { name: deptName } });
        assignedDepartmentId = dept?.id ?? null;
      }
    }

    const user = await prisma.user.create({
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

    await createActivityLog({
      userId: req.user!.id,
      action: 'EMPLOYEE_CREATED',
      entityType: 'User',
      entityId: user.id,
      description: `Created employee: ${user.name}`,
      req
    });

    await createNotification({
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a user
// @route   PUT /api/users/:id
// @access  Private/SuperAdmin, Manager
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const targetId = Number(req.params.id);
    if (isNaN(targetId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await prisma.user.findUnique({ where: { id: targetId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'SuperAdmin' && req.user?.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Only SuperAdmin can modify SuperAdmin accounts' });
    }

    const { name, role, departmentId, designation, isActive } = req.body;

    if (role !== undefined && role !== user.role) {
      if (req.user?.role !== 'SuperAdmin') {
        return res.status(403).json({ message: 'Only SuperAdmin can change user roles' });
      }
      if (req.user?.id === targetId) {
        return res.status(400).json({ message: 'You cannot change your own role' });
      }
    }

    if (isActive !== undefined && isActive !== user.isActive && req.user?.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Only SuperAdmin can activate or deactivate accounts' });
    }

    let assignedDepartmentId = departmentId !== undefined ? (departmentId ? Number(departmentId) : null) : user.departmentId;
    
    // Auto-update department if role changed and no department explicitly passed
    if (departmentId === undefined && role && role !== user.role) {
      const deptName = role === 'DevEmployee' ? 'Development' : role === 'MediaEmployee' ? 'Media' : null;
      if (deptName) {
        const dept = await prisma.department.findUnique({ where: { name: deptName } });
        if (dept) assignedDepartmentId = dept.id;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetId },
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

    await createActivityLog({
      userId: req.user!.id,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'User',
      entityId: updatedUser.id,
      description: `Updated employee: ${updatedUser.name}`,
      req
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Deactivate a user
// @route   PATCH /api/users/:id/deactivate
// @access  Private/SuperAdmin
export const deactivateUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);

    if (req.user?.id === userId) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    const userToDeactivate = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToDeactivate) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userToDeactivate.role === 'SuperAdmin') {
      const superAdminCount = await prisma.user.count({ where: { role: 'SuperAdmin', isActive: true } });
      if (superAdminCount <= 1) {
        return res.status(400).json({ message: 'Cannot deactivate the last active SuperAdmin' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
    
    await createActivityLog({
      userId: req.user!.id,
      action: 'EMPLOYEE_DEACTIVATED',
      entityType: 'User',
      entityId: updatedUser.id,
      description: `Deactivated employee ID ${updatedUser.id}`,
      req
    });
    
    await createNotification({
      userId: updatedUser.id,
      title: 'Account Deactivated',
      message: 'Your BizLeap account has been deactivated.',
      type: 'employee_deactivated',
      entityType: 'User',
      entityId: updatedUser.id
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Activate a user
// @route   PATCH /api/users/:id/activate
// @access  Private/SuperAdmin
export const activateUser = async (req: AuthRequest, res: Response) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { isActive: true },
    });
    res.json({ message: 'User activated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/SuperAdmin
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);

    if (req.user?.id === userId) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userToDelete.role === 'SuperAdmin') {
      const superAdminCount = await prisma.user.count({ where: { role: 'SuperAdmin', isActive: true } });
      if (superAdminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last active SuperAdmin' });
      }
    }
    
    // Manual cascade delete inside transaction for safety
    await prisma.$transaction(async (tx) => {
      await tx.taskSubmission.deleteMany({ where: { userId } });
      await tx.taskSubmission.deleteMany({ where: { reviewedById: userId } });
      await tx.comment.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.activityLog.deleteMany({ where: { userId } });
      await tx.dailyReport.deleteMany({ where: { userId } });
      await tx.dailyReport.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });
      await tx.teamMembership.deleteMany({ where: { userId } });
      await tx.clientMembership.deleteMany({ where: { userId } });
      await tx.team.updateMany({ where: { leadId: userId }, data: { leadId: null } });

      // Update tasks assigned TO this user to be Unassigned
      await tx.task.updateMany({
        where: { assignedToId: userId },
        data: { assignedToId: null, status: 'Pending' }
      });

      // Delete tasks assigned BY this user and their dependent comments/submissions
      const tasksAssignedBy = await tx.task.findMany({ where: { assignedById: userId }, select: { id: true } });
      const taskIds = tasksAssignedBy.map(t => t.id);
      if (taskIds.length > 0) {
        await tx.comment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskSubmission.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }

      await tx.user.delete({
        where: { id: userId }
      });
    });
    
    await createActivityLog({
      userId: req.user!.id,
      action: 'EMPLOYEE_REMOVED',
      entityType: 'User',
      entityId: userId,
      description: `Removed employee ID ${userId}`,
      req
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const grantPasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const resetTokenHash = crypto.createHash('sha256').update(resetCode).digest('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { 
        canResetPassword: true, 
        resetPasswordRequested: false,
        resetTokenHash,
        resetTokenExpiresAt
      }
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'PASSWORD_RESET_GRANTED',
      entityType: 'User',
      entityId: userId,
      description: `Approved password reset for user ID ${userId}`,
      req
    });

    await createNotification({
      userId,
      title: 'Password Reset Approved',
      message: 'Admin has approved your password reset request. Use the reset code provided by your admin.',
      type: 'system_alert',
      entityType: 'User',
      entityId: userId
    });

    res.json({
      message: 'Password reset granted successfully',
      resetCode,
      expiresAt: resetTokenExpiresAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
