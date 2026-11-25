import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { createActivityLog } from '../utils/activityLogUtils';
import prisma from '../prismaClient';

const createTeamSchema = z.object({
  name: z.string().min(2, 'Team name is required'),
  departmentId: z.number().int().positive().optional().nullable(),
  leadId: z.number().int().positive().optional().nullable(),
});

const addMemberSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(['Lead', 'Member']).default('Member'),
});

export const getTeams = async (req: AuthRequest, res: Response) => {
  try {
    const teams = await prisma.team.findMany({
      where: { isActive: true },
      include: {
        department: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, email: true, role: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, designation: true, isActive: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (error) {
    console.error('Get Teams Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
    }
    const { name, departmentId, leadId } = parsed.data;

    const existing = await prisma.team.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: 'A team with this name already exists' });
    }

    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          name,
          departmentId: departmentId ?? null,
          leadId: leadId ?? null,
        },
      });
      if (leadId) {
        await tx.teamMembership.create({
          data: { teamId: created.id, userId: leadId, role: 'Lead' },
        });
      }
      return created;
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'TEAM_CREATED',
      entityType: 'Team',
      entityId: team.id,
      description: `Created team: ${team.name}`,
      req,
    });

    res.status(201).json(team);
  } catch (error) {
    console.error('Create Team Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = Number(req.params.id);
    if (isNaN(teamId)) return res.status(400).json({ message: 'Invalid team ID' });

    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid input' });
    }

    const { userId, role } = parsed.data;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return res.status(404).json({ message: 'Active user not found' });

    const membership = await prisma.teamMembership.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: { role },
      create: { teamId, userId, role },
    });

    if (role === 'Lead') {
      await prisma.team.update({ where: { id: teamId }, data: { leadId: userId } });
    }

    await createActivityLog({
      userId: req.user!.id,
      action: 'TEAM_MEMBER_ADDED',
      entityType: 'Team',
      entityId: teamId,
      description: `Added user ID ${userId} to team ${team.name} as ${role}`,
      req,
    });

    res.status(201).json(membership);
  } catch (error) {
    console.error('Add Team Member Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const removeTeamMember = async (req: AuthRequest, res: Response) => {
  try {
    const teamId = Number(req.params.id);
    const userId = Number(req.params.userId);
    if (isNaN(teamId) || isNaN(userId)) return res.status(400).json({ message: 'Invalid ID' });

    await prisma.teamMembership.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    await prisma.team.updateMany({
      where: { id: teamId, leadId: userId },
      data: { leadId: null },
    });

    await createActivityLog({
      userId: req.user!.id,
      action: 'TEAM_MEMBER_REMOVED',
      entityType: 'Team',
      entityId: teamId,
      description: `Removed user ID ${userId} from team ID ${teamId}`,
      req,
    });

    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Remove Team Member Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
