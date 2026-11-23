import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { createActivityLog } from '../utils/activityLogUtils';
import { createNotification } from '../utils/notificationUtils';
import { AuthRequest } from '../middleware/authMiddleware';

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
    let whereClause: any = {
      role: { not: 'SuperAdmin' },
      deletedAt: null
    };

    const users = await prisma.user.findMany({
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

    if (role === 'SuperAdmin' && req.user?.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Only SuperAdmin can create SuperAdmin accounts' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let assignedDepartmentId = departmentId ? Number(departmentId) : null;
    if (!assignedDepartmentId) {
      if (role === 'DevEmployee') assignedDepartmentId = 1;
      else if (role === 'MediaEmployee') assignedDepartmentId = 2;
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
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });

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
      if (role === 'DevEmployee') assignedDepartmentId = 1;
      else if (role === 'MediaEmployee') assignedDepartmentId = 2;
    }

    const updatedUser = await prisma.user.update({
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

    if (role && role !== user.role) {
      await createActivityLog({
        userId: req.user!.id,
        action: 'CHANGE_USER_ROLE',
        entityType: 'User',
        entityId: user.id,
        description: `${req.user!.name} changed role of ${user.name} from ${user.role} to ${role}`,
        actorType: 'User',
        actorName: req.user!.name,
        req
      });
    }

    await createActivityLog({
      userId: req.user!.id,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'User',
      entityId: updatedUser.id,
      description: `Updated employee: ${updatedUser.name}`,
      actorType: 'User',
      actorName: req.user!.name,
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
      data: { isActive: false },
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
      const superAdminCount = await prisma.user.count({ where: { role: 'SuperAdmin', isActive: true, deletedAt: null } });
      if (superAdminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last active SuperAdmin' });
      }
    }
    
    // Soft delete user: deactivate and timestamp (no hard delete)
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        deletedById: req.user!.id
      }
    });

    // Revoke all active sessions for this deactivated user
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    // Unassign pending tasks
    await prisma.task.updateMany({
      where: { assignedToId: userId, status: 'Pending' },
      data: { assignedToId: null }
    });
    
    await createActivityLog({
      userId: req.user!.id,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: userId,
      description: `${req.user!.name} soft-deleted employee ${userToDelete.name} (${userToDelete.email})`,
      actorType: 'User',
      actorName: req.user!.name,
      req
    });

    res.json({ message: 'User deactivated and removed from active list successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const grantPasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id);
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { 
        canResetPassword: true, 
        resetPasswordRequested: false 
      }
    });

    await createNotification({
      userId,
      title: 'Password Reset Approved',
      message: 'Admin has approved your password reset request. You can now reset your password on the login page.',
      type: 'system_alert',
      entityType: 'User',
      entityId: userId
    });

    res.json({ message: 'Password reset granted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
