"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteTasks = exports.deleteTask = exports.updateTaskStatus = exports.updateTask = exports.getTaskById = exports.getMyTasks = exports.getTasks = exports.createTask = void 0;
const activityLogUtils_1 = require("../utils/activityLogUtils");
const notificationUtils_1 = require("../utils/notificationUtils");
const prismaClient_1 = __importDefault(require("../prismaClient"));
// @desc    Create a task
// @route   POST /api/tasks
// @access  Private/SuperAdmin, Manager
const createTask = async (req, res) => {
    try {
        const { title, description, departmentId, category, assignedToId, priority, deadline, proofRequired, proofType, clientId, projectId, clientName, clientDetails, driveLink, socialMediaPlatform, postType, githubRepo, environment } = req.body;
        // Validate assigned employee belongs to department
        if (assignedToId) {
            const user = await prismaClient_1.default.user.findUnique({ where: { id: Number(assignedToId) } });
            if (!user || user.departmentId !== Number(departmentId)) {
                return res.status(400).json({ message: 'Assigned employee must belong to the selected department.' });
            }
        }
        let resolvedClientName = clientName;
        const parsedClientId = clientId ? Number(clientId) : null;
        const parsedProjectId = projectId ? Number(projectId) : null;
        if (parsedClientId && !resolvedClientName) {
            const clientRecord = await prismaClient_1.default.client.findUnique({ where: { id: parsedClientId }, select: { name: true } });
            if (clientRecord)
                resolvedClientName = clientRecord.name;
        }
        const task = await prismaClient_1.default.task.create({
            data: {
                title,
                description,
                departmentId: Number(departmentId),
                category,
                assignedToId: assignedToId ? Number(assignedToId) : null,
                assignedById: req.user.id,
                priority: priority || 'Medium',
                deadline: new Date(deadline),
                proofRequired: proofRequired ?? true,
                proofType,
                status: 'Pending',
                clientId: parsedClientId,
                projectId: parsedProjectId,
                clientName: resolvedClientName,
                clientDetails,
                driveLink,
                socialMediaPlatform,
                postType,
                githubRepo,
                environment,
            },
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'TASK_CREATED',
            entityType: 'Task',
            entityId: task.id,
            description: `Created task: ${task.title}`,
            req
        });
        if (assignedToId) {
            await (0, notificationUtils_1.createNotification)({
                userId: Number(assignedToId),
                title: 'New Task Assigned',
                message: `New task assigned: ${task.title}`,
                type: 'task_assigned',
                entityType: 'Task',
                entityId: task.id
            });
        }
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager') {
            const adminsAndManagers = await prismaClient_1.default.user.findMany({
                where: { role: { in: ['SuperAdmin', 'Manager'] } },
                select: { id: true }
            });
            for (const admin of adminsAndManagers) {
                await (0, notificationUtils_1.createNotification)({
                    userId: admin.id,
                    title: 'Employee Assigned Task',
                    message: `${req.user.name} assigned a task: ${task.title}`,
                    type: 'task_assigned',
                    entityType: 'Task',
                    entityId: task.id
                });
            }
        }
        res.status(201).json(task);
    }
    catch (error) {
        console.error('Create Task Error:', error);
        res.status(500).json({ message: 'Server error creating task' });
    }
};
exports.createTask = createTask;
// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
    try {
        const { role, id, departmentId } = req.user;
        // Build where clause based on role
        let whereClause = { isDeleted: false };
        if (role === 'SuperAdmin') {
            // SuperAdmin sees all non-deleted
        }
        else if (role === 'Manager') {
            // Manager sees all tasks since there's only one manager
        }
        else {
            // Employee sees their assigned tasks and tasks they created
            whereClause = { ...whereClause, OR: [{ assignedToId: id }, { assignedById: id }] };
        }
        // Apply query filters
        if (req.query.departmentId)
            whereClause.departmentId = Number(req.query.departmentId);
        if (req.query.status)
            whereClause.status = String(req.query.status);
        if (req.query.priority)
            whereClause.priority = String(req.query.priority);
        if (req.query.assignedToId)
            whereClause.assignedToId = Number(req.query.assignedToId);
        if (req.query.clientId)
            whereClause.clientId = Number(req.query.clientId);
        if (req.query.projectId)
            whereClause.projectId = Number(req.query.projectId);
        // Check for overdue status dynamically if requested, otherwise return all
        // Since overdue is derived, we handle standard statuses here
        const tasks = await prismaClient_1.default.task.findMany({
            where: whereClause,
            include: {
                assignedTo: { select: { id: true, name: true, role: true } },
                assignedBy: { select: { id: true, name: true, role: true } },
                department: { select: { id: true, name: true } },
                client: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tasks);
    }
    catch (error) {
        console.error('Get Tasks Error:', error);
        res.status(500).json({ message: 'Server error fetching tasks' });
    }
};
exports.getTasks = getTasks;
// @desc    Get my tasks (Employee specific)
// @route   GET /api/tasks/my
// @access  Private
const getMyTasks = async (req, res) => {
    try {
        const tasks = await prismaClient_1.default.task.findMany({
            where: { assignedToId: req.user.id, isDeleted: false },
            include: {
                department: { select: { id: true, name: true } },
                assignedBy: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tasks);
    }
    catch (error) {
        console.error('Get My Tasks Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMyTasks = getMyTasks;
// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
    try {
        const taskId = Number(req.params.id);
        if (isNaN(taskId))
            return res.status(400).json({ message: 'Invalid task ID' });
        const task = await prismaClient_1.default.task.findFirst({
            where: { id: taskId, isDeleted: false },
            include: {
                assignedTo: { select: { id: true, name: true, role: true } },
                assignedBy: { select: { id: true, name: true, role: true } },
                department: { select: { id: true, name: true } },
                submissions: {
                    where: { isDeleted: false },
                    include: { user: { select: { id: true, name: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                comments: {
                    include: { user: { select: { id: true, name: true } } },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        if (!task)
            return res.status(404).json({ message: 'Task not found' });
        // Validate access
        const { role, id } = req.user;
        if (role !== 'SuperAdmin' && role !== 'Manager') {
            if (task.assignedToId !== id && task.assignedById !== id) {
                return res.status(403).json({ message: 'Not authorized to view this task' });
            }
        }
        res.json(task);
    }
    catch (error) {
        console.error('Get Task Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getTaskById = getTaskById;
// @desc    Update task details
// @route   PUT /api/tasks/:id
// @access  Private/SuperAdmin, Manager
const updateTask = async (req, res) => {
    try {
        const taskId = Number(req.params.id);
        if (isNaN(taskId))
            return res.status(400).json({ message: 'Invalid task ID' });
        const existingTask = await prismaClient_1.default.task.findFirst({ where: { id: taskId, isDeleted: false } });
        if (!existingTask)
            return res.status(404).json({ message: 'Task not found' });
        const isAdminOrManager = req.user.role === 'SuperAdmin' || req.user.role === 'Manager';
        // Block if approved (unless SuperAdmin or Manager)
        if (!isAdminOrManager) {
            if (existingTask.assignedById !== req.user.id) {
                return res.status(403).json({ message: 'Not authorized to edit this task' });
            }
            if (existingTask.status === 'Approved') {
                return res.status(403).json({ message: 'Cannot edit an approved task' });
            }
        }
        const { title, description, category, assignedToId, priority, deadline, proofRequired, proofType, clientName, clientDetails, driveLink, socialMediaPlatform, postType, githubRepo, environment, status } = req.body;
        if (status !== undefined && status !== existingTask.status && !isAdminOrManager) {
            return res.status(403).json({ message: 'Only SuperAdmin or Manager can change task status directly' });
        }
        const nextAssignedToId = assignedToId === undefined
            ? existingTask.assignedToId
            : (assignedToId ? Number(assignedToId) : null);
        if (nextAssignedToId && nextAssignedToId !== existingTask.assignedToId) {
            const targetUser = await prismaClient_1.default.user.findUnique({ where: { id: nextAssignedToId } });
            if (!targetUser || targetUser.departmentId !== existingTask.departmentId) {
                return res.status(400).json({ message: 'Assigned employee must belong to the task department.' });
            }
        }
        const updatedTask = await prismaClient_1.default.task.update({
            where: { id: taskId },
            data: {
                title,
                description,
                category,
                assignedToId: nextAssignedToId,
                priority,
                deadline: deadline ? new Date(deadline) : undefined,
                proofRequired,
                proofType,
                clientName,
                clientDetails,
                driveLink,
                socialMediaPlatform,
                postType,
                githubRepo,
                environment,
                status: isAdminOrManager ? status : undefined
            }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'TASK_UPDATED',
            entityType: 'Task',
            entityId: updatedTask.id,
            description: `Updated task: ${updatedTask.title}`,
            req
        });
        if (updatedTask.assignedToId) {
            await (0, notificationUtils_1.createNotification)({
                userId: updatedTask.assignedToId,
                title: 'Task Updated',
                message: `Task updated: ${updatedTask.title}`,
                type: 'system',
                entityType: 'Task',
                entityId: updatedTask.id
            });
        }
        res.json(updatedTask);
    }
    catch (error) {
        console.error('Update Task Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateTask = updateTask;
// @desc    Update task status
// @route   PATCH /api/tasks/:id/status
// @access  Private
const updateTaskStatus = async (req, res) => {
    try {
        const taskId = Number(req.params.id);
        if (isNaN(taskId))
            return res.status(400).json({ message: 'Invalid task ID' });
        const { status } = req.body;
        const task = await prismaClient_1.default.task.findFirst({ where: { id: taskId, isDeleted: false } });
        if (!task)
            return res.status(404).json({ message: 'Task not found' });
        // Role-based restrictions
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager') {
            if (task.assignedToId !== req.user.id) {
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
        const updatedTask = await prismaClient_1.default.task.update({
            where: { id: taskId },
            data: { status }
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: req.user.id,
            action: 'TASK_STATUS_UPDATED',
            entityType: 'Task',
            entityId: updatedTask.id,
            description: `Task status updated to ${status}`,
            req
        });
        res.json(updatedTask);
    }
    catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateTaskStatus = updateTaskStatus;
// @desc    Delete/Archive task
// @route   DELETE /api/tasks/:id
// @access  Private/SuperAdmin
const deleteTask = async (req, res) => {
    try {
        const taskId = Number(req.params.id);
        const task = await prismaClient_1.default.task.findUnique({ where: { id: taskId } });
        if (!task)
            return res.status(404).json({ message: 'Task not found' });
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager') {
            if (task.assignedById !== req.user.id) {
                return res.status(403).json({ message: 'Not authorized to delete this task' });
            }
        }
        // Soft delete the task
        await prismaClient_1.default.task.update({ where: { id: taskId }, data: { isDeleted: true } });
        res.json({ message: 'Task deleted successfully' });
    }
    catch (error) {
        console.error('Delete Task Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteTask = deleteTask;
// @desc    Bulk delete tasks
// @route   DELETE /api/tasks/bulk
// @access  Private
const bulkDeleteTasks = async (req, res) => {
    try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'A non-empty array of task IDs is required' });
        }
        const numericIds = ids.map(Number).filter(n => !isNaN(n));
        if (numericIds.length === 0) {
            return res.status(400).json({ message: 'Valid task IDs are required' });
        }
        const whereClause = { id: { in: numericIds }, isDeleted: false };
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager') {
            whereClause.assignedById = req.user.id;
        }
        const deleted = await prismaClient_1.default.task.updateMany({ where: whereClause, data: { isDeleted: true } });
        res.json({ message: `${deleted.count} tasks deleted successfully` });
    }
    catch (error) {
        console.error('Bulk Delete Task Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.bulkDeleteTasks = bulkDeleteTasks;
