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
