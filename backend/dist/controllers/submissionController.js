"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingSubmissions = exports.rejectSubmission = exports.approveSubmission = exports.submitTask = void 0;
const client_1 = require("@prisma/client");
const activityLogUtils_1 = require("../utils/activityLogUtils");
const notificationUtils_1 = require("../utils/notificationUtils");
const prisma = new client_1.PrismaClient();
// @desc    Submit a task for review
// @route   POST /api/tasks/:taskId/submit
// @access  Private (Employee)
const submitTask = async (req, res) => {
    try {
        const taskId = Number(req.params.id);
        const { reportText, proofUrl, proofFileName, proofType, completionPercentage, blockers, notes } = req.body;
        const userId = req.user.id;
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task)
            return res.status(404).json({ message: 'Task not found' });
        if (task.assignedToId !== userId) {
            return res.status(403).json({ message: 'You can only submit tasks assigned to you' });
        }
        if (task.proofRequired && (!proofUrl && !proofFileName)) {
            return res.status(400).json({ message: 'Proof is required for this task' });
        }
        // Create Submission
        const submission = await prisma.taskSubmission.create({
            data: {
                taskId,
                userId,
                reportText,
                proofUrl,
                proofFileName,
                proofType,
                completionPercentage: Number(completionPercentage),
                blockers,
                notes,
                reviewStatus: 'Pending Review'
            }
        });
        // Update Task Status
        await prisma.task.update({
            where: { id: taskId },
            data: { status: 'Submitted' }
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
        const reviewerId = req.user.id;
        const submission = await prisma.taskSubmission.findUnique({
            where: { id: submissionId },
            include: { task: true }
        });
        if (!submission)
            return res.status(404).json({ message: 'Submission not found' });
        // Update Submission
        const updatedSubmission = await prisma.taskSubmission.update({
            where: { id: submissionId },
            data: {
                reviewStatus: 'Approved',
                reviewedById: reviewerId,
                reviewedAt: new Date()
            }
        });
        // Update Task
        await prisma.task.update({
            where: { id: submission.taskId },
            data: { status: 'Approved' }
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
        const { managerFeedback } = req.body;
        const reviewerId = req.user.id;
        if (!managerFeedback || managerFeedback.trim() === '') {
            return res.status(400).json({ message: 'Feedback is required to reject a task' });
        }
        const submission = await prisma.taskSubmission.findUnique({
            where: { id: submissionId },
            include: { task: true }
        });
        if (!submission)
            return res.status(404).json({ message: 'Submission not found' });
        // Update Submission
        const updatedSubmission = await prisma.taskSubmission.update({
            where: { id: submissionId },
            data: {
                reviewStatus: 'Rejected',
                managerFeedback,
                reviewedById: reviewerId,
                reviewedAt: new Date()
            }
        });
        // Update Task Status back to Rejected
        await prisma.task.update({
            where: { id: submission.taskId },
            data: { status: 'Rejected' }
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
        let whereClause = { reviewStatus: 'Pending Review' };
        if (role === 'Manager') {
            // Manager sees all pending submissions
        }
        const submissions = await prisma.taskSubmission.findMany({
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
