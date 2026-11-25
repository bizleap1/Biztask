"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteSubmissions = exports.deleteSubmission = exports.getPendingSubmissions = exports.rejectSubmission = exports.approveSubmission = exports.submitTask = void 0;
const activityLogUtils_1 = require("../utils/activityLogUtils");
const notificationUtils_1 = require("../utils/notificationUtils");
const prismaClient_1 = __importDefault(require("../prismaClient"));
// @desc    Submit a task for review
// @route   POST /api/tasks/:taskId/submit
// @access  Private (Employee)
const submitTask = async (req, res) => {
    try {
        const taskId = Number(req.params.id);
        if (isNaN(taskId))
            return res.status(400).json({ message: 'Invalid task ID' });
        const { reportText, proofUrl, proofFileName, proofType, completionPercentage, blockers, notes } = req.body;
        const userId = req.user.id;
        if (!reportText || typeof reportText !== 'string' || !reportText.trim()) {
            return res.status(400).json({ message: 'Report text is required' });
        }
        const task = await prismaClient_1.default.task.findFirst({ where: { id: taskId, isDeleted: false } });
        if (!task)
            return res.status(404).json({ message: 'Task not found' });
        if (task.assignedToId !== userId) {
            return res.status(403).json({ message: 'You can only submit tasks assigned to you' });
        }
        if (task.status === 'Approved') {
            return res.status(400).json({ message: 'Cannot submit an already approved task' });
        }
        if (task.proofRequired && (!proofUrl && !proofFileName)) {
            return res.status(400).json({ message: 'Proof is required for this task' });
        }
        const parsedPct = completionPercentage !== undefined && completionPercentage !== '' && !isNaN(Number(completionPercentage))
            ? Math.min(100, Math.max(0, Number(completionPercentage)))
            : 100;
        // Create Submission and update Task status atomically
        const submission = await prismaClient_1.default.$transaction(async (tx) => {
            const created = await tx.taskSubmission.create({
                data: {
                    taskId,
                    userId,
                    reportText,
                    proofUrl,
                    proofFileName,
                    proofType,
                    completionPercentage: parsedPct,
                    blockers,
                    notes,
                    reviewStatus: 'Pending Review'
                }
            });
            await tx.task.update({
                where: { id: taskId },
                data: { status: 'Submitted' }
            });
            return created;
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId,
            action: 'TASK_SUBMITTED',
            entityType: 'TaskSubmission',
            entityId: submission.id,
            description: `Submitted task: ${task.title}`,
            req
        });
        if (proofUrl || proofFileName) {
            await (0, activityLogUtils_1.createActivityLog)({
                userId,
                action: 'FILE_UPLOADED',
                entityType: 'TaskSubmission',
                entityId: submission.id,
                description: `Uploaded proof for task: ${task.title}`,
                req
            });
        }
        await (0, notificationUtils_1.createNotification)({
            userId: task.assignedById,
            title: 'Task Submitted',
            message: `Task submitted for review: ${task.title}`,
            type: 'task_submitted',
            entityType: 'TaskSubmission',
            entityId: submission.id
        });
        res.status(201).json(submission);
    }
    catch (error) {
        console.error('Submit Task Error:', error);
        res.status(500).json({ message: 'Server error submitting task' });
    }
};
exports.submitTask = submitTask;
// @desc    Approve a submission
// @route   PATCH /api/submissions/:id/approve
// @access  Private/SuperAdmin, Manager
const approveSubmission = async (req, res) => {
    try {
        const submissionId = Number(req.params.id);
        if (isNaN(submissionId))
            return res.status(400).json({ message: 'Invalid submission ID' });
        const reviewerId = req.user.id;
        const submission = await prismaClient_1.default.taskSubmission.findFirst({
            where: { id: submissionId, isDeleted: false },
            include: { task: true }
        });
        if (!submission || submission.task.isDeleted)
            return res.status(404).json({ message: 'Submission not found' });
        if (submission.reviewStatus !== 'Pending Review') {
            return res.status(400).json({ message: `Submission is already ${submission.reviewStatus}` });
        }
        const updatedSubmission = await prismaClient_1.default.$transaction(async (tx) => {
            const updated = await tx.taskSubmission.update({
                where: { id: submissionId },
                data: {
                    reviewStatus: 'Approved',
                    reviewedById: reviewerId,
                    reviewedAt: new Date()
                }
            });
            await tx.task.update({
                where: { id: submission.taskId },
                data: { status: 'Approved' }
            });
            return updated;
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: reviewerId,
            action: 'TASK_APPROVED',
            entityType: 'TaskSubmission',
            entityId: updatedSubmission.id,
            description: `Approved task: ${submission.task.title}`,
            req
        });
        await (0, notificationUtils_1.createNotification)({
            userId: submission.userId,
            title: 'Task Approved',
            message: `Your task has been approved: ${submission.task.title}`,
            type: 'task_approved',
            entityType: 'TaskSubmission',
            entityId: updatedSubmission.id
        });
        res.json(updatedSubmission);
    }
    catch (error) {
        console.error('Approve Submission Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.approveSubmission = approveSubmission;
// @desc    Reject a submission
// @route   PATCH /api/submissions/:id/reject
// @access  Private/SuperAdmin, Manager
const rejectSubmission = async (req, res) => {
    try {
        const submissionId = Number(req.params.id);
        if (isNaN(submissionId))
            return res.status(400).json({ message: 'Invalid submission ID' });
        const { managerFeedback } = req.body;
        const reviewerId = req.user.id;
        if (!managerFeedback || managerFeedback.trim() === '') {
            return res.status(400).json({ message: 'Feedback is required to reject a task' });
        }
        const submission = await prismaClient_1.default.taskSubmission.findFirst({
            where: { id: submissionId, isDeleted: false },
            include: { task: true }
        });
        if (!submission || submission.task.isDeleted)
            return res.status(404).json({ message: 'Submission not found' });
        if (submission.reviewStatus !== 'Pending Review') {
            return res.status(400).json({ message: `Submission is already ${submission.reviewStatus}` });
        }
        const updatedSubmission = await prismaClient_1.default.$transaction(async (tx) => {
            const updated = await tx.taskSubmission.update({
                where: { id: submissionId },
                data: {
                    reviewStatus: 'Rejected',
                    managerFeedback,
                    reviewedById: reviewerId,
                    reviewedAt: new Date()
                }
            });
            await tx.task.update({
                where: { id: submission.taskId },
                data: { status: 'Rejected' }
            });
            return updated;
        });
        await (0, activityLogUtils_1.createActivityLog)({
            userId: reviewerId,
            action: 'TASK_REJECTED',
            entityType: 'TaskSubmission',
            entityId: updatedSubmission.id,
            description: `Rejected task: ${submission.task.title}`,
            req
        });
        await (0, notificationUtils_1.createNotification)({
            userId: submission.userId,
            title: 'Task Rejected',
            message: `Your task was rejected: ${submission.task.title}. Please check feedback.`,
            type: 'task_rejected',
            entityType: 'TaskSubmission',
            entityId: updatedSubmission.id
        });
        res.json(updatedSubmission);
    }
    catch (error) {
        console.error('Reject Submission Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.rejectSubmission = rejectSubmission;
// @desc    Get pending submissions for review
// @route   GET /api/submissions/pending
// @access  Private/SuperAdmin, Manager
const getPendingSubmissions = async (req, res) => {
    try {
        const { role, departmentId, id } = req.user;
        let whereClause = {
            reviewStatus: 'Pending Review',
            isDeleted: false,
            task: { isDeleted: false }
        };
        if (role === 'Manager') {
            // Manager sees all pending submissions
        }
        const submissions = await prismaClient_1.default.taskSubmission.findMany({
            where: whereClause,
            include: {
                task: {
                    select: { title: true, department: { select: { name: true } } }
                },
                user: { select: { name: true } }
            },
            orderBy: { submittedAt: 'desc' }
        });
        res.json(submissions);
    }
    catch (error) {
        console.error('Get Submissions Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getPendingSubmissions = getPendingSubmissions;
// @desc    Delete submission
// @route   DELETE /api/submissions/:id
// @access  Private
const deleteSubmission = async (req, res) => {
    try {
        const sub = await prismaClient_1.default.taskSubmission.findUnique({ where: { id: Number(req.params.id) } });
        if (!sub)
            return res.status(404).json({ message: 'Submission not found' });
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager' && sub.userId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        await prismaClient_1.default.taskSubmission.update({ where: { id: Number(req.params.id) }, data: { isDeleted: true } });
        res.json({ message: 'Submission deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteSubmission = deleteSubmission;
// @desc    Bulk delete submissions
// @route   DELETE /api/submissions/bulk
// @access  Private
const bulkDeleteSubmissions = async (req, res) => {
    try {
        const ids = req.body?.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'A non-empty array of submission IDs is required' });
        }
        const numericIds = ids.map(Number).filter(n => !isNaN(n));
        if (numericIds.length === 0) {
            return res.status(400).json({ message: 'Valid submission IDs are required' });
        }
        const whereClause = { id: { in: numericIds }, isDeleted: false };
        if (req.user.role !== 'SuperAdmin' && req.user.role !== 'Manager') {
            whereClause.userId = req.user.id;
        }
        const deleted = await prismaClient_1.default.taskSubmission.updateMany({ where: whereClause, data: { isDeleted: true } });
        res.json({ message: `${deleted.count} submissions deleted successfully` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.bulkDeleteSubmissions = bulkDeleteSubmissions;
