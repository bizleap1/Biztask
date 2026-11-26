import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../prismaClient';
import { createActivityLog } from '../utils/activityLogUtils';
import { createNotification } from '../utils/notificationUtils';

const canManageMeetings = (role: string) => ['SuperAdmin', 'Manager', 'TeamLead'].includes(role);

const meetingInclude = {
  organizer: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, name: true } },
  attendees: { include: { user: { select: { id: true, name: true, email: true } } } },
  minutes: { include: { recordedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' as const } },
  actionItems: { include: { assignee: { select: { id: true, name: true } }, task: { select: { id: true, title: true, status: true } } }, orderBy: { createdAt: 'asc' as const } }
};

export const getMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const where: any = { isDeleted: false };
    const now = new Date();
    if (req.query.view === 'today') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      now.setHours(0, 0, 0, 0);
      tomorrow.setHours(0, 0, 0, 0);
      where.startAt = { gte: now, lt: tomorrow };
    } else if (req.query.view === 'next7') {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      where.startAt = { gte: now, lte: end };
    }
    if (!canManageMeetings(req.user!.role) && req.user!.role !== 'SuperAdmin') {
      where.attendees = { some: { userId: req.user!.id } };
    }
    const meetings = await prisma.meeting.findMany({
      where,
      include: meetingInclude,
      orderBy: { startAt: 'asc' }
    });
    res.json(meetings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading meetings' });
  }
};

export const getMeetingById = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid meeting ID' });
    const meeting = await prisma.meeting.findFirst({
      where: {
        id,
        isDeleted: false,
        ...(canManageMeetings(req.user!.role) ? {} : { attendees: { some: { userId: req.user!.id } } })
      },
      include: meetingInclude
    });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    res.json(meeting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading meeting' });
  }
};

export const createMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, agenda, startAt, durationMinutes, locationLink, clientId, repeatWeekly, attendeeIds } = req.body;
    if (!title || !startAt) return res.status(400).json({ message: 'Title and start time are required' });
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Invalid start time' });
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 5) return res.status(400).json({ message: 'Duration must be at least 5 minutes' });

    const ids = Array.isArray(attendeeIds)
      ? [...new Set(attendeeIds.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value)))]
      : [];
    const meeting = await prisma.meeting.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        agenda: agenda ? String(agenda).trim() : null,
        startAt: start,
        durationMinutes: duration,
        locationLink: locationLink ? String(locationLink).trim() : null,
        repeatWeekly: repeatWeekly === true,
        clientId: clientId ? Number(clientId) : null,
        organizerId: req.user!.id,
        attendees: { create: ids.map((userId: number) => ({ userId })) }
      },
      include: meetingInclude
    });
    await createActivityLog({ userId: req.user!.id, action: 'MEETING_CREATED', entityType: 'Meeting', entityId: meeting.id, description: `Created meeting: ${meeting.title}`, req });
    for (const userId of ids) {
      await createNotification({
        userId,
        title: 'Meeting Invitation',
        message: `${meeting.title} is scheduled for ${start.toLocaleString()}`,
        type: 'meeting_invitation',
        entityType: 'Meeting',
        entityId: meeting.id
      });
    }
    res.status(201).json(meeting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating meeting' });
  }
};

export const updateMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.meeting.findFirst({ where: { id, isDeleted: false } });
    if (!existing) return res.status(404).json({ message: 'Meeting not found' });
    if (existing.organizerId !== req.user!.id && req.user!.role !== 'SuperAdmin') return res.status(403).json({ message: 'Only the organizer or SuperAdmin can update this meeting' });

    const { title, description, agenda, startAt, durationMinutes, locationLink, clientId, repeatWeekly, status, attendeeIds } = req.body;
    await prisma.meeting.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(agenda !== undefined ? { agenda: agenda ? String(agenda).trim() : null } : {}),
        ...(startAt !== undefined ? { startAt: new Date(startAt) } : {}),
        ...(durationMinutes !== undefined ? { durationMinutes: Number(durationMinutes) } : {}),
        ...(locationLink !== undefined ? { locationLink: locationLink ? String(locationLink).trim() : null } : {}),
        ...(clientId !== undefined ? { clientId: clientId ? Number(clientId) : null } : {}),
        ...(repeatWeekly !== undefined ? { repeatWeekly: repeatWeekly === true } : {}),
        ...(status !== undefined ? { status: String(status) } : {})
      }
    });
    if (Array.isArray(attendeeIds)) {
      const ids = [...new Set(attendeeIds.map((value: unknown) => Number(value)).filter((value: number) => Number.isInteger(value)))];
      await prisma.meetingAttendee.deleteMany({ where: { meetingId: id } });
      await prisma.meetingAttendee.createMany({ data: ids.map((userId: number) => ({ meetingId: id, userId })) });
    }
    const meeting = await prisma.meeting.findUnique({ where: { id }, include: meetingInclude });
    await createActivityLog({ userId: req.user!.id, action: 'MEETING_UPDATED', entityType: 'Meeting', entityId: id, description: `Updated meeting: ${meeting?.title || id}`, req });
    res.json(meeting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating meeting' });
  }
};

export const saveMeetingMinutes = async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = Number(req.params.id);
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ message: 'Meeting minutes content is required' });
    const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, isDeleted: false } });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    const minute = await prisma.meetingMinute.create({ data: { meetingId, content, recordedById: req.user!.id }, include: { recordedBy: { select: { id: true, name: true } } } });
    res.status(201).json(minute);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error saving meeting minutes' });
  }
};

export const createMeetingActionItem = async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = Number(req.params.id);
    const { title, description, assigneeId, dueDate } = req.body;
    if (!title) return res.status(400).json({ message: 'Action item title is required' });
    const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, isDeleted: false } });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    const item = await prisma.meetingActionItem.create({
      data: {
        meetingId,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        assigneeId: assigneeId ? Number(assigneeId) : null,
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: { assignee: { select: { id: true, name: true } } }
    });
    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating action item' });
  }
};

export const convertMeetingActionItemToTask = async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const item = await prisma.meetingActionItem.findFirst({ where: { id: itemId, meetingId } });
    if (!item) return res.status(404).json({ message: 'Action item not found' });
    if (item.taskId) return res.status(409).json({ message: 'Action item has already been converted', taskId: item.taskId });

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    const assigneeId = item.assigneeId || meeting.organizerId;
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { departmentId: true } });
    if (!assignee?.departmentId) return res.status(400).json({ message: 'Assign the action item to a user with a department before conversion' });

    const task = await prisma.task.create({
      data: {
        title: item.title,
        description: item.description || `Action item from meeting: ${meeting.title}`,
        category: 'Meeting Action',
        departmentId: assignee.departmentId,
        assignedToId: assigneeId,
        assignedById: req.user!.id,
        deadline: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        meetingId,
        clientId: meeting.clientId
      }
    });
    await prisma.meetingActionItem.update({ where: { id: itemId }, data: { taskId: task.id, status: 'Converted' } });
    await createActivityLog({ userId: req.user!.id, action: 'MEETING_ACTION_CONVERTED', entityType: 'MeetingActionItem', entityId: itemId, description: `Converted action item to task: ${task.title}`, req });
    await createNotification({
      userId: assigneeId,
      title: 'Meeting Action Assigned',
      message: `${item.title} was created from a meeting and assigned to you`,
      type: 'task_assigned',
      entityType: 'Task',
      entityId: task.id
    });
    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error converting action item to task' });
  }
};
