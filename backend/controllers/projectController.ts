import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { createActivityLog } from '../utils/activityLogUtils';
import prisma from '../prismaClient';

const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  description: z.string().optional().nullable(),
  clientId: z.number().int().positive('Client is required'),
  departmentId: z.number().int().positive().optional().nullable(),
  status: z.enum(['Active', 'On Hold', 'Completed', 'Cancelled']).default('Active'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const updateProjectSchema = createProjectSchema.partial();

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const whereClause: any = { isActive: true };
    if (req.query.clientId) {
      whereClause.clientId = Number(req.query.clientId);
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        client: { select: { id: true, name: true, status: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  } catch (error) {
    console.error('Get Projects Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
    }
    const data = parsed.data;

    const client = await prisma.client.findFirst({ where: { id: data.clientId, isActive: true } });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        clientId: data.clientId,
        departmentId: data.departmentId ?? null,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
      include: {
        client: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project.id,
      description: `Created project: ${project.name} for client ${client.name}`,
      req,
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create Project Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid project ID' });

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const existing = await prisma.project.findFirst({ where: { id, isActive: true } });
    if (!existing) return res.status(404).json({ message: 'Project not found' });

    const data = parsed.data;
    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.clientId !== undefined && { clientId: data.clientId }),
        ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      },
      include: {
        client: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update Project Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid project ID' });

    const existing = await prisma.project.findFirst({ where: { id, isActive: true } });
    if (!existing) return res.status(404).json({ message: 'Project not found' });

    await prisma.project.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Project archived successfully' });
  } catch (error) {
    console.error('Delete Project Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
