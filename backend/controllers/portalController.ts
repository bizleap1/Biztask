import { Response } from 'express';
import prisma from '../prismaClient';
import { AuthRequest } from '../middleware/authMiddleware';

const getMembershipClientIds = async (userId: number) => {
  const memberships = await prisma.clientMembership.findMany({
    where: { userId, isRevoked: false },
    select: { clientId: true }
  });
  return memberships.map(member => member.clientId);
};

export const getPortalOverview = async (req: AuthRequest, res: Response) => {
  try {
    const clientIds = await getMembershipClientIds(req.user!.id);
    if (clientIds.length === 0) return res.status(403).json({ message: 'No active client account membership' });
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, isActive: true },
      include: {
        projects: { where: { isActive: true }, select: { id: true, name: true, status: true } },
        tasks: { where: { isDeleted: false, clientVisible: true }, select: { id: true, status: true, deadline: true } },
        meetings: { where: { isDeleted: false, status: { not: 'Cancelled' } }, select: { id: true, title: true, startAt: true } }
      }
    });
    res.json({ clients });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading client portal overview' });
  }
};

export const getPortalTasks = async (req: AuthRequest, res: Response) => {
  try {
    const clientIds = await getMembershipClientIds(req.user!.id);
    if (clientIds.length === 0) return res.status(403).json({ message: 'No active client account membership' });
    const tasks = await prisma.task.findMany({
      where: {
        isDeleted: false,
        clientVisible: true,
        clientId: { in: clientIds }
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      },
      orderBy: { deadline: 'asc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading portal tasks' });
  }
};

export const getPortalTaskById = async (req: AuthRequest, res: Response) => {
  try {
    const clientIds = await getMembershipClientIds(req.user!.id);
    const id = Number(req.params.id);
    const task = await prisma.task.findFirst({
      where: { id, isDeleted: false, clientVisible: true, clientId: { in: clientIds } },
      include: {
        assignedTo: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      }
    });
    if (!task) return res.status(404).json({ message: 'Portal task not found' });
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading portal task' });
  }
};

export const approvePortalTask = async (req: AuthRequest, res: Response) => {
  try {
    const clientIds = await getMembershipClientIds(req.user!.id);
    const id = Number(req.params.id);
    const status = req.body.status;
    if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Status must be Approved or Rejected' });
    const task = await prisma.task.findFirst({ where: { id, isDeleted: false, clientVisible: true, clientId: { in: clientIds } } });
    if (!task) return res.status(404).json({ message: 'Portal task not found' });
    const updated = await prisma.task.update({ where: { id }, data: { clientApprovalStatus: status } });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating client task approval' });
  }
};

export const getPortalInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const clientIds = await getMembershipClientIds(req.user!.id);
    const invoices = await prisma.invoice.findMany({
      where: { clientId: { in: clientIds }, status: { in: ['Issued', 'PartiallyPaid', 'Paid', 'Overdue'] } },
      include: { items: true, receipts: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading portal invoices' });
  }
};

export const getPortalReports = async (req: AuthRequest, res: Response) => {
  try {
    const clientIds = await getMembershipClientIds(req.user!.id);
    const reports = await prisma.portalReport.findMany({
      where: { clientId: { in: clientIds }, status: 'Published' },
      orderBy: [{ reportingYear: 'desc' }, { reportingMonth: 'desc' }]
    });
    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading portal reports' });
  }
};

export const createPortalRequest = async (req: AuthRequest, res: Response) => {
  try {
    const clientIds = await getMembershipClientIds(req.user!.id);
    const clientId = Number(req.body.clientId);
    if (!clientIds.includes(clientId)) return res.status(403).json({ message: 'Not authorized for this client account' });
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    if (!title || !description) return res.status(400).json({ message: 'Title and description are required' });
    const request = await prisma.clientRequest.create({
      data: { clientId, requestedById: req.user!.id, title, description }
    });
    res.status(201).json(request);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating client request' });
  }
};

export const getPortalRequests = async (req: AuthRequest, res: Response) => {
  try {
    const clientIds = await getMembershipClientIds(req.user!.id);
    const requests = await prisma.clientRequest.findMany({
      where: { clientId: { in: clientIds } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading client requests' });
  }
};

export const convertPortalRequest = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const request = await prisma.clientRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Client request not found' });
    if (request.status === 'Converted') return res.status(409).json({ message: 'Request already converted' });
    const departmentId = Number(req.body.departmentId);
    if (!Number.isInteger(departmentId)) return res.status(400).json({ message: 'departmentId is required' });
    const task = await prisma.task.create({
      data: {
        title: request.title,
        description: request.description,
        category: 'Client Request',
        departmentId,
        assignedById: req.user!.id,
        assignedToId: req.body.assignedToId ? Number(req.body.assignedToId) : null,
        deadline: req.body.deadline ? new Date(req.body.deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        clientId: request.clientId,
        clientVisible: true
      }
    });
    await prisma.clientRequest.update({
      where: { id },
      data: { status: 'Converted', taskId: task.id }
    });
    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error converting client request' });
  }
};

export const previewPortalAsClient = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = Number(req.params.clientId);
    const client = await prisma.client.findFirst({
      where: { id: clientId, isActive: true },
      include: {
        tasks: { where: { isDeleted: false, clientVisible: true }, select: { id: true, title: true, status: true, deadline: true, clientApprovalStatus: true } },
        invoices: { where: { status: { in: ['Issued', 'PartiallyPaid', 'Paid', 'Overdue'] } }, select: { id: true, invoiceNumber: true, totalAmount: true, amountPaid: true, status: true } },
        portalReports: { where: { status: 'Published' }, orderBy: [{ reportingYear: 'desc' }, { reportingMonth: 'desc' }] }
      }
    });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error previewing client portal' });
  }
};

export const getIntegrationStatus = async (_req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.integrationAccount.findMany({ orderBy: { provider: 'asc' } });
    const logs = await prisma.syncLog.findMany({ orderBy: { startedAt: 'desc' }, take: 50 });
    res.json({ accounts, recentSyncs: logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error loading integration status' });
  }
};
