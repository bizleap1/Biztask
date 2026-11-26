import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middleware/authMiddleware';

const startOfUtcDay = (value = new Date()) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export const checkIn = async (req: AuthRequest, res: Response) => {
  try {
    const workDate = startOfUtcDay();
    const existing = await prisma.attendance.findFirst({ where: { userId: req.user!.id, workDate, isDeleted: false } });
    if (existing) return res.status(409).json({ message: 'Already checked in today', attendance: existing });
    const record = await prisma.attendance.create({
      data: { userId: req.user!.id, workDate, checkInAt: new Date(), status: 'Present', source: 'Manual' }
    });
    res.status(201).json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error recording check-in' });
  }
};

export const checkOut = async (req: AuthRequest, res: Response) => {
  try {
    const workDate = startOfUtcDay();
    const existing = await prisma.attendance.findFirst({ where: { userId: req.user!.id, workDate, isDeleted: false } });
    if (!existing) return res.status(400).json({ message: 'Check-in is required before check-out' });
    if (existing.checkOutAt) return res.status(409).json({ message: 'Already checked out today', attendance: existing });
    const record = await prisma.attendance.update({ where: { id: existing.id }, data: { checkOutAt: new Date() } });
    res.json(record);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error recording check-out' });
  }
};

export const getAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const where: any = { isDeleted: false };
    if (req.user!.role === 'Employee' || req.user!.role === 'DevEmployee' || req.user!.role === 'MediaEmployee') {
      where.userId = req.user!.id;
    } else if (req.query.userId) {
      where.userId = Number(req.query.userId);
    }
    if (req.query.startDate && req.query.endDate) {
      where.workDate = { gte: new Date(String(req.query.startDate)), lte: new Date(String(req.query.endDate)) };
    }
    const records = await prisma.attendance.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: { workDate: 'desc' } });
    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading attendance' });
  }
};

export const importAttendance = async (req: AuthRequest, res: Response) => {
  try {
    if (!Array.isArray(req.body.records)) return res.status(400).json({ message: 'records must be an array' });
    let imported = 0;
    let skipped = 0;
    for (const row of req.body.records) {
      if (!row.userId || !row.workDate || !row.externalRef) {
        skipped++;
        continue;
      }
      const workDate = startOfUtcDay(new Date(row.workDate));
      const existing = await prisma.attendance.findFirst({
        where: { userId: Number(row.userId), externalRef: String(row.externalRef), isDeleted: false }
      });
      if (existing) { skipped++; continue; }
      await prisma.attendance.create({
        data: {
          userId: Number(row.userId),
          workDate,
          checkInAt: row.checkInAt ? new Date(row.checkInAt) : null,
          checkOutAt: row.checkOutAt ? new Date(row.checkOutAt) : null,
          status: row.status || 'Present',
          source: row.source || 'Petpooja',
          externalRef: String(row.externalRef)
        }
      });
      imported++;
    }
    res.json({ imported, skipped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error importing attendance' });
  }
};

export const requestLeave = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.body.startDate || !req.body.endDate) return res.status(400).json({ message: 'Start and end dates are required' });
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      return res.status(400).json({ message: 'Invalid leave date range' });
    }
    const leave = await prisma.leaveRequest.create({
      data: { userId: req.user!.id, leaveType: req.body.leaveType || 'Casual', startDate, endDate, reason: req.body.reason || null }
    });
    res.status(201).json(leave);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error requesting leave' });
  }
};

export const getLeaveRequests = async (req: AuthRequest, res: Response) => {
  try {
    const privileged = ['SuperAdmin', 'Manager', 'TeamLead'].includes(req.user!.role);
    const requests = await prisma.leaveRequest.findMany({
      where: privileged ? {} : { userId: req.user!.id },
      include: { user: { select: { id: true, name: true } }, approver: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading leave requests' });
  }
};

export const decideLeave = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!['Approved', 'Rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Status must be Approved or Rejected' });
    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Leave request not found' });
    if (existing.status !== 'Pending') return res.status(409).json({ message: 'Leave request already decided' });
    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: { status: req.body.status, approverId: req.user!.id }
    });
    res.json(leave);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deciding leave request' });
  }
};
