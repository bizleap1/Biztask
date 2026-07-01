import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createActivityLog } from '../utils/activityLogUtils';
import { createNotification } from '../utils/notificationUtils';
import { AuthRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private/SuperAdmin, Manager
export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, departmentId, category, assignedToId, priority, deadline, proofRequired, proofType } = req.body;

    // Validate assigned employee belongs to department
    if (assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: Number(assignedToId) } });
      if (!user || user.departmentId !== Number(departmentId)) {
        return res.status(400).json({ message: 'Assigned employee must belong to the selected department.' });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        departmentId: Number(departmentId),
        category,
        assignedToId: assignedToId ? Number(assignedToId) : null,
        assignedById: req.user!.id,
        priority: priority || 'Medium',
        deadline: new Date(deadline),
        proofRequired: proofRequired ?? true,
        proofType,
        status: 'Pending',
      },
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'TASK_CREATED',
      entityType: 'Task',
      entityId: task.id,
      description: `Created task: ${task.title}`,
      req
    });

    if (assignedToId) {
      await createNotification({
        userId: Number(assignedToId),
        title: 'New Task Assigned',
        message: `New task assigned: ${task.title}`,
        type: 'task_assigned',
        entityType: 'Task',
        entityId: task.id
      });
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Create Task Error:', error);
    res.status(500).json({ message: 'Server error creating task' });
  }
};

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { role, id, departmentId } = req.user!;
    
    // Build where clause based on role
    let whereClause: any = {};
    if (role === 'SuperAdmin') {
      // SuperAdmin sees all
    } else if (role === 'Manager') {
      // Manager sees all tasks since there's only one manager
      whereClause = {};
    } else {
      // Employee sees only their tasks
      whereClause = { assignedToId: id };
    }

    // Apply query filters
    if (req.query.departmentId) whereClause.departmentId = Number(req.query.departmentId);
    if (req.query.status) whereClause.status = String(req.query.status);
    if (req.query.priority) whereClause.priority = String(req.query.priority);
    if (req.query.assignedToId) whereClause.assignedToId = Number(req.query.assignedToId);
    
    // Check for overdue status dynamically if requested, otherwise return all
    // Since overdue is derived, we handle standard statuses here
    
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get Tasks Error:', error);
    res.status(500).json({ message: 'Server error fetching tasks' });
  }
};

// @desc    Get my tasks (Employee specific)
// @route   GET /api/tasks/my
// @access  Private
export const getMyTasks = async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { assignedToId: req.user!.id },
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('Get My Tasks Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
export const getTaskById = async (req: AuthRequest, res: Response) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
        department: { select: { id: true, name: true } },
        submissions: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Validate access
    const { role, id } = req.user!;
    if (role !== 'SuperAdmin' && role !== 'Manager') {
      if (task.assignedToId !== id) {
        return res.status(403).json({ message: 'Not authorized to view this task' });
      }
    }

    res.json(task);
  } catch (error) {
    console.error('Get Task Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update task details
// @route   PUT /api/tasks/:id
// @access  Private/SuperAdmin, Manager
export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) return res.status(404).json({ message: 'Task not found' });

    // Block if approved (unless SuperAdmin)
    if (existingTask.status === 'Approved' && req.user!.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Cannot edit an approved task' });
    }

    const { title, description, category, assignedToId, priority, deadline, proofRequired, proofType } = req.body;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        category,
        assignedToId: assignedToId ? Number(assignedToId) : null,
        priority,
        deadline: deadline ? new Date(deadline) : undefined,
        proofRequired,
        proofType
      }
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'TASK_UPDATED',
      entityType: 'Task',
      entityId: updatedTask.id,
      description: `Updated task: ${updatedTask.title}`,
      req
    });

    if (updatedTask.assignedToId) {
      await createNotification({
        userId: updatedTask.assignedToId,
        title: 'Task Updated',
        message: `Task updated: ${updatedTask.title}`,
        type: 'system',
        entityType: 'Task',
        entityId: updatedTask.id
      });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Update Task Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update task status
// @route   PATCH /api/tasks/:id/status
// @access  Private
export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const { status } = req.body;
    
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Role-based restrictions
    if (req.user!.role !== 'SuperAdmin' && req.user!.role !== 'Manager') {
      if (task.assignedToId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      if (status === 'Approved' || status === 'Completed' || status === 'Rejected') {
        return res.status(403).json({ message: 'Employees cannot approve, complete, or reject tasks directly' });
      }
      // Employee can only set to 'In Progress' directly via this endpoint
      if (status !== 'In Progress') {
        return res.status(403).json({ message: 'Employees can only update status to In Progress directly' });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status }
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'TASK_STATUS_UPDATED',
      entityType: 'Task',
      entityId: updatedTask.id,
      description: `Task status updated to ${status}`,
      req
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete/Archive task
// @route   DELETE /api/tasks/:id
// @access  Private/SuperAdmin
export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    
    // First delete any associated submissions and comments to prevent foreign key constraint errors
    await prisma.taskSubmission.deleteMany({ where: { taskId } });
    await prisma.comment.deleteMany({ where: { taskId } });
    
    // Then delete the task itself
    await prisma.task.delete({ where: { id: taskId } });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete Task Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
